import { assertEquals, assertRejects, assertMatch } from './common.ts'
import * as git from '../lib/git.ts'
import { notNull } from '../lib/util/object.ts'
import { Context } from './git_ctx.ts'
import { run, runOutput } from "../lib/cmd.ts";

Deno.test('git unclean detection', () => Context.run(async (ctx: Context) => {
	assertEquals(await git.uncommittedChanges(ctx.gitOpts), null)
	await git.requireClean(ctx.gitOpts)
	await git.requireCleanAround(ctx.gitOpts, () => Promise.resolve())

	// now make some chanegs
	let runCount = 0
	const action = () => {
		runCount++
		return ctx.write('a', 'a updated')
	}
	await assertRejects(() => git.requireCleanAround(ctx.gitOpts, action), 'ERROR: clean workspace required after action')
	assertEquals(runCount, 1)

	await assertRejects(() => git.requireCleanAround(ctx.gitOpts, action), 'ERROR: clean workspace required before action')
	// shouldn't run again
	assertEquals(runCount, 1)

	await assertRejects(() => git.requireClean(ctx.gitOpts), 'ERROR: clean workspace required')
	assertMatch(notNull(await git.uncommittedChanges(ctx.gitOpts)), /-a initial\n\+a updated/m)
	
	await git.addAll(ctx.gitOpts)
	assertMatch(notNull(await git.uncommittedChanges(ctx.gitOpts)), /-a initial\n\+a updated/m)
	assertEquals(await git.uncommittedChanges({ ... ctx.gitOpts, includeStaged: false }), null)
}))


Deno.test('git untracked detection', () => Context.run(async (ctx: Context) => {
	ctx.write('c', 'untracked')
	assertEquals(await git.uncommittedChanges( { ...ctx.gitOpts, includeUntracked: true }), ' - Untracked file: c')
	assertEquals(await git.uncommittedChanges( { ...ctx.gitOpts, includeUntracked: false }), null)
	assertEquals(await git.uncommittedChanges(ctx.gitOpts), ' - Untracked file: c')
}))

Deno.test('git branch name', () => Context.run(async (ctx: Context) => {
	assertEquals(await git.branchName(ctx.gitOpts), 'master')
	await run(['git', 'switch', '--detach', 'HEAD'], ctx.runOpts)
	assertEquals(await git.branchName(ctx.gitOpts), null)
}))

Deno.test('git commit', () => Context.run(async (ctx: Context) => {
	ctx.write('c', 'new file')
	const catC = () => runOutput(['git', 'show', 'HEAD:c'], ctx.runOpts)
	await git.commitAllChanges({ ...ctx.gitOpts, includeUntracked: true, identity: git.nobody, commitMessage: 'new stuff' })

	assertEquals(await runOutput(['git', 'log', '-1', '--format=%s %cn %ce %an %ae'], ctx.runOpts),
		'new stuff nobody nobody@localhost nobody nobody@localhost'
	)
	assertEquals(await catC(), 'new file')

	ctx.write('c', 'new file (updated)')
	await git.amendAllChanges({ ...ctx.gitOpts, includeUntracked: true })
	assertEquals(await runOutput(['git', 'log', '-1', '--format=%s'], ctx.runOpts), 'new stuff')
	assertEquals(await catC(), 'new file (updated)')
}))
