import { assertEquals, assertRejects, assertMatch } from '../common.ts'
import { run, RunOpts } from '../../lib/cmd.ts'
import * as git from '../../lib/git.ts'
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import notNull from '../../lib/util/not_null.ts'

class Context {
	dir: string
	runOpts: RunOpts
	gitOpts: git.RequireCleanOptions

	constructor(dir: string) {
		this.dir = dir
		this.runOpts = { cwd: dir, printCommand: false, stdout: 'printOnError', stderr: 'printOnError' }
		this.gitOpts = { gitDir: dir, printDiff: false, colorDiff: false }
	}

	async init() {
		await this.write("a", "a initial")
		await this.write("b", "b initial")
		await run(['git', 'init'], this.runOpts)
		await run(['git', 'add', '.'], this.runOpts)
		await run(['git', 'commit', '-m', 'initial'], this.runOpts)
	}

	write(p: string, c: string) {
		return Deno.writeTextFile(`${this.dir}/${p}`, c + '\n')
	}
}

Deno.test('git unclean detection', async () => {
	await withTempDir({}, async (dir: string) => {
		const ctx = new Context(dir)
		await ctx.init()

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
	})
})


Deno.test('git untracked detection', async () => {
	await withTempDir({}, async (dir: string) => {
		const ctx = new Context(dir)
		await ctx.init()

		ctx.write('c', 'untracked')
		await assertEquals(await git.uncommittedChanges(ctx.gitOpts), null)
		await assertEquals(await git.uncommittedChanges( { ...ctx.gitOpts, includeUntracked: true }), ' - Untracked file: c')
	})
})
