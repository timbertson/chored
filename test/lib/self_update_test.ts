import { runOutput } from "../../lib/cmd.ts";
import { assertEquals, assertNotEquals, assertRejects, fail } from "../common.ts";
import { Context } from './git_ctx.ts'

import { selfUpdate, _makePullRequestHandler, _makePushHandler, PullRequestOptions } from '../../lib/self_update.ts'
import * as Git from '../../lib/git.ts'
import * as GH from '../../lib/github/api.ts'
import * as Graphql from '../../lib/graphql.ts'

const commitMessage = 'test commit'
function getLastCommitMessage(dir: string) {
	return runOutput(['git', 'log', '-1', '--format=%s'], { cwd: dir, printCommand: false })
}

Deno.test('self update rejects uncommitted changes', () => Context.run(async (ctx: Context) => {
	await ctx.write('a', 'updated a')
	await assertRejects(() => selfUpdate({
		commitMessage,
		update:() => fail('update invoked'),
		gitDir: ctx.dir,
	}), undefined, 'ERROR: clean workspace required')
}))

function makeHandler() {
	const handler = {
		wrapped: false,
		onChanged: false,
		wrap: async (fn: () => Promise<void>) => {
			handler.wrapped = true
			return fn()
		},
		onChange: () => {
			handler.onChanged = true
			return Promise.resolve()
		}
	}
	return handler
}

Deno.test('self update commits changes and invokes handler', () => Context.run(async (ctx: Context) => {
	const handler = makeHandler()
	assertEquals(await selfUpdate({
		commitMessage,
		update:() => ctx.write('a', 'updated a'),
		handler,
		gitDir: ctx.dir,
	}), true)
	assertEquals(await getLastCommitMessage(ctx.dir), commitMessage)
	assertEquals(await Git.uncommittedChanges({gitDir: ctx.dir}), null)
	assertEquals(handler.wrapped, true)
	assertEquals(handler.onChanged, true)
}))

Deno.test('self update noop', () => Context.run(async (ctx: Context) => {
	const handler = makeHandler()
	assertEquals(await selfUpdate({
		commitMessage,
		update: async () => {},
		gitDir: ctx.dir,
		handler,
	}), false)
	assertNotEquals(await getLastCommitMessage(ctx.dir), commitMessage)
	assertEquals(handler.wrapped, true)
	assertEquals(handler.onChanged, false)
}))

class GithubStub {
	commands: Array<string[]> = []
	pullRequests: Array<GH.CreateOrUpdatePROptions> = []
	
	runCommand(cmd: string[]) {
		this.commands.push(cmd)
		return Promise.resolve()
	}

	makePush() {
		return _makePushHandler({ runCommand: this.runCommand.bind(this) })
	}

	makePullRequest() {
		return _makePullRequestHandler({
			silenceErrors: true,
			runCommand: this.runCommand.bind(this),
			makeClient: (token: string) => {
				const client = GH.Client(token)
				const self = this
				;(client as any).execute = (..._: any[]) => Promise.resolve(null)
				client.createOrUpdatePullRequest = (opts: GH.CreateOrUpdatePROptions) => {
					self.pullRequests.push(opts)
					return Promise.resolve({} as GH.PullRequestIdentity)
				}
				return client
			},
			pushHandler: this.makePush(),
		})
	}
}

Deno.test('push handler', async () => {
	const stub = new GithubStub()
	const handler = stub.makePush()({
		branchName: 'test'
	})

	// propagaes errors
	const e = new Error("test failure")
	await assertRejects(() => handler.wrap(() => (Promise.reject(e) as Promise<void>)), undefined, e.message)
	
	await handler.onChange()
	assertEquals(stub.commands, [
		[
			"git",
			"push",
			"origin",
			"HEAD:refs/heads/test",
		],
	])
})

const prOptions: PullRequestOptions = {
	baseBranch: "base-branch",
	branchName: "feature-branch",
	githubToken: "abcd1234",
	prTitle: "title",
	prBody: "body",
	repository: {
		owner: 'timbertson',
		name: 'does-not-exist',
	}
}

Deno.test('pull request handler updates PR on error', async () => {
	const stub = new GithubStub()
	const handler = await stub.makePullRequest()(prOptions)

	const e = new Error("test failure")
	await assertRejects(() => handler.wrap(() => (Promise.reject(e) as Promise<void>)), undefined, e.message)
	
	assertEquals(stub.pullRequests.map(x => x.body), [
		"## :no_entry_sign: **NOTE: an error occurred while generating this PR: `test failure`\n\nbody"
	])

	assertEquals(stub.commands, [
		[
			"git",
			"commit",
			"--allow-empty",
			"--message",
			"empty commit",
		],
		[
			"git",
			"push",
			"--force",
			"origin",
			"HEAD:refs/heads/feature-branch",
		],
	])
})

Deno.test('pull request handler updates PR on change', async () => {
	const stub = new GithubStub()
	const handler = await stub.makePullRequest()(prOptions)
	await handler.onChange()
	assertEquals(stub.pullRequests.map(x => x.body), ['body'])

	assertEquals(stub.commands, [
		[
			"git",
			"push",
			"--force",
			"origin",
			"HEAD:refs/heads/feature-branch",
		],
	])
})
