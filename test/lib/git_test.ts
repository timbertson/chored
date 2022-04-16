import { assertEquals, assertRejects, assertMatch } from '../common.ts'
import * as git from '../../lib/git.ts'
import notNull from '../../lib/util/not_null.ts'
import { Context } from './git_ctx.ts'

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
	await assertRejects(() => git.requireCleanAround(ctx.gitOpts, action), undefined, 'ERROR: clean workspace required after action')
	await assertEquals(runCount, 1)

	await assertRejects(() => git.requireCleanAround(ctx.gitOpts, action), undefined, 'ERROR: clean workspace required before action')
	// shouldn't run again
	await assertEquals(runCount, 1)

	await assertRejects(() => git.requireClean(ctx.gitOpts), undefined, 'ERROR: clean workspace required')
	await assertMatch(notNull(await git.uncommittedChanges(ctx.gitOpts)), /-a initial\n\+a updated/m)
	
	await git.addAll(ctx.gitOpts)
	await assertMatch(notNull(await git.uncommittedChanges(ctx.gitOpts)), /-a initial\n\+a updated/m)
	await assertEquals(await git.uncommittedChanges({ ... ctx.gitOpts, includeStaged: false }), null)
}))


Deno.test('git untracked detection', () => Context.run(async (ctx: Context) => {
	ctx.write('c', 'untracked')
	await assertEquals(await git.uncommittedChanges( { ...ctx.gitOpts, includeUntracked: true }), ' - Untracked file: c')
	await assertEquals(await git.uncommittedChanges( { ...ctx.gitOpts, includeUntracked: false }), null)
	await assertEquals(await git.uncommittedChanges(ctx.gitOpts), ' - Untracked file: c')
}))
