import { run, RunOpts } from '../lib/cmd.ts'
import * as git from '../lib/git.ts'
import withTempDir from '../lib/fs/with_temp_dir.ts'

export class Context {
	dir: string
	runOpts: RunOpts
	gitOpts: git.RequireCleanOptions

	constructor(dir: string) {
		this.dir = dir
		this.runOpts = { cwd: dir, printCommand: false, stdout: 'printOnError', stderr: 'printOnError', env: git.identityEnv(git.nobody) }
		this.gitOpts = { gitDir: dir, printDiff: false, colorDiff: false }
	}
	
	static async run<T>(fn: (c: Context) => Promise<T>): Promise<T> {
		return withTempDir<T>({}, async (dir: string) => {
			const c = new Context(dir)
			await c.init()
			return await fn(c)
		})
	}

	async init() {
		await this.write("a", "a initial")
		await this.write("b", "b initial")
		await run(['git', 'init'], this.runOpts)
		await run(['git', 'add', '.'], this.runOpts)
		await run(['git', 'config', 'user.name', 'nobody'], this.runOpts)
		await run(['git', 'config', 'user.email', 'nobody@localhost'], this.runOpts)
		await run(['git', 'commit', '-m', 'initial'], this.runOpts)
	}

	write(p: string, c: string) {
		return Deno.writeTextFile(`${this.dir}/${p}`, c + '\n')
	}

	read(p: string) {
		return Deno.readTextFile(`${this.dir}/${p}`)
	}
}
