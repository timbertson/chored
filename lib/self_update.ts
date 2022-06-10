import { run } from "./cmd.ts";
import * as Git from './git.ts'
import * as GH from "./github/api.ts";
import * as Env from "./github/run_env.ts";
import { notNull } from './util/object.ts'

export interface Handler {
	wrap: (fn: () => Promise<void>) => Promise<void>,
	onChange(): Promise<void>,
}

export const noopHandler: Handler = {
	wrap: (fn: () => Promise<void>) => fn(),
	onChange: () => Promise.resolve(),
}

export interface Options {
	update: () => Promise<void>,
	commitMessage: string,
	gitDir?: string,
	handler?: Handler,
}

const commonGitOpts: Git.CommonOptions = { identity: Git.githubActionsBot }

export async function selfUpdate(opts: Options): Promise<boolean> {
	const handler = opts.handler || noopHandler
	const gitOpts: Git.RequireCleanOptions = { ... commonGitOpts, gitDir: opts.gitDir, printDiff: false }
	await Git.requireClean(gitOpts)
	
	const hasGitChanges = async () => {
		const gitChanges = await Git.uncommittedChanges(gitOpts)
		if (gitChanges == null) {
			console.log('No changes detected after update')
		}
		return gitChanges != null
	}

	await handler.wrap(() => opts.update())

	const changed = await hasGitChanges()
	if (changed) {
		await Git.commitAllChanges({
			...gitOpts,
			includeUntracked: true,
			commitMessage: opts.commitMessage,
		})
		await handler.onChange()
	}
	return changed
}


export interface PushOptions {
	forcePush?: boolean,
	remote?: string,
	branchName?: string,
}

interface CommonPullRequestOptions extends PushOptions {
	baseBranch: string,
	branchName: string,
	prTitle: string
	prBody: string
	repository?: Env.Repository
}

export interface PullRequestOptions extends CommonPullRequestOptions {
	githubToken: string
}

type MakePushHandler = (opts?: PushOptions) => Handler

export function _makePushHandler(impl: {
	runCommand: (cmd: string[]) => Promise<void>
}): MakePushHandler {
	return function pushHandler(opts?: PushOptions): Handler {
		return {
			wrap: noopHandler.wrap,
			onChange: async () => {
				const branch = opts?.branchName ?? await Git.branchName()
				const args = ['git', 'push']
				if (opts?.forcePush === true) {
					args.push('--force')
				}
				args.push(opts?.remote ?? 'origin', `HEAD:refs/heads/${branch}`)
				await impl.runCommand(args)
			}
		}
	}
}

const realEnv = {
	runCommand: (cmd: string[]) => run(cmd).then(_ => {})
}
export const pushHandler = _makePushHandler(realEnv)

export function _makePullRequestHandler(impl: {
	silenceErrors: boolean,
	pushHandler: MakePushHandler,
	commitAll: (opts: Git.CommitAllOptions) => Promise<void>,
	makeClient: (token: string) => GH.GithubClient,
}): (opts: PullRequestOptions) => Promise<Handler> {
	return async function pullRequestHandler(opts: PullRequestOptions): Promise<Handler> {
		const token = opts.githubToken
		const repo = notNull(opts.repository ?? Env.repository, 'repository')
		const client = impl.makeClient(token)

		// validate token eagerly
		const _: GH.UserIdentity = await client.execute(GH.getAuthenticatedUser, null)

		const prOpts = {
			body: opts.prBody,
			title: opts.prTitle,
			baseBranch: opts.baseBranch,
			branchName: opts.branchName,
			owner: repo.owner,
			repo: repo.name,
		}
		
		if (Env.runId) {
			const { owner, name } = notNull(Env.repository ?? opts.repository, 'repository')
			prOpts.body += ("\n\n---\n\n" +
				"This PR was created from a workflow, [click here to view logs]("
				+ `https://github.com/${owner}/${name}/actions/runs/${Env.runId}`
				+ ")."
			)
		}
		
		const push = impl.pushHandler({ ... opts, forcePush: true })

		return {
			wrap: async (fn: () => Promise<void>) => {
				try {
					await fn()
				} catch(e) {
					const error: Error = (e instanceof Error) ? e : new Error(e)
					if (!impl.silenceErrors) {
						console.error(`Error occurred while applying update`, error.stack)
					}

					// ensure there's at least one commit
					await impl.commitAll({
						... commonGitOpts,
						allowEmpty: true,
						includeUntracked: false,
						commitMessage: 'empty commit',
					})
					await push.onChange()

					await client.createOrUpdatePullRequest({
						...prOpts,
						title: prOpts.title + ' :no_entry_sign:',
						body: (
							`# Error:\n\nAn error occurred while generating this pull request: \`${error.message}\`\n\n`
							+ 'You may need to re-run this action and fix the errors manually. This pull request is created for visibility, '
							+ 'it may not have any useful changes.\n\n---\n\n'
							+ prOpts.body
						)
					})
					throw e
				}
			},
			onChange: async () => {
				await push.onChange()
				await client.createOrUpdatePullRequest(prOpts)
			}
		}
	}
}

export const pullRequestHandler = _makePullRequestHandler({
	silenceErrors: false,
	pushHandler,
	commitAll: Git.commitAllChanges,
	makeClient: GH.Client,
})

export interface PartialPullRequestOptions extends CommonPullRequestOptions {
	githubToken?: string
}

export type Mode = 'noop'|'pr'|'push'

export async function standardSelfUpdate(opts: Options & {
	pr: PartialPullRequestOptions,
	push?: PushOptions,
	mode: Mode
}): Promise<boolean> {
	let handler = noopHandler
	if (opts.mode == 'pr') {
		handler = await pullRequestHandler({
			...opts.pr,
			githubToken: notNull(opts.pr.githubToken, 'githubToken'),
		})
	} else if (opts.mode === 'push') {
		handler = pushHandler(opts.push)
	}
	return selfUpdate({
		... opts,
		handler
	})
}
