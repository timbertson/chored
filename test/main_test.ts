import { assertEquals, assertThrows, assertRejects } from './common.ts'
import { DenoFS, FakeFS } from '../lib/fs/impl.ts'
import { run } from '../lib/cmd.ts'
import withTempDir from '../lib/fs/with_temp_dir.ts'
import * as Main from '../main.ts'
import { Config, defaultConfig } from '../lib/chored_config.ts'
import replaceSuffix from '../lib/util/replace_suffix.ts'

Deno.test("bootstrap", async () => {
	const here = Deno.cwd()
	const bootstrapModule = `file://${here}/lib/bootstrap.ts`
	await withTempDir({ prefix: 'chored-test-' }, async (testDir: string) => {
		await run(['bash', '-c', `cat ${here}/install.sh | env BOOTSTRAP_OVERRIDE='${bootstrapModule}' bash`], {
			cwd: testDir,
			printCommand: false,
			stdout: 'discard',
		})
		
		const readdir = (p: string) => {
			const ret = Array.from(Deno.readDirSync(p)).map(entry => entry.name)
			ret.sort()
			return ret
		}
		assertEquals(readdir(testDir), ['.gitattributes', 'chored', 'choredefs'])
		assertEquals(readdir(testDir + '/choredefs'), ['render.ts'])

		// test the generated project runs
		await run([`${testDir}/chored`, 'render'], {
			cwd: testDir,
			printCommand: false
		})
	})
})

Deno.test("run", () => withTempDir({}, async (dir) => {
	await DenoFS.writeTextFile(`${dir}/a.ts`, `
		export function main(opts: {}) { return "chore a!" }
		export function async(opts: {}) { return Promise.resolve("chore a (async)!") }
	`)

	await DenoFS.writeTextFile(`${dir}/index.ts`, `
		export function b(opts: {}) { return "index b!" }
		export function main(opts: {}) { return "main!" }
	`)

	const moduleURI = (name: string) => `file://${dir}/${name}.ts`
	const config: Config = { ...defaultConfig, taskRoot: dir }

	assertEquals(await Main.run(config, ['a'], {}), 'chore a!')
	assertEquals(await Main.run(config, ['a', 'async'], {}), 'chore a (async)!')

	assertEquals(await Main.resolveEntrypoint(config, ['b']), {
		module: moduleURI('index'), fn: 'b'
	})
	assertEquals(await Main.run(config, ['b'], {}), 'index b!')
	assertEquals(await Main.run(config, [], {}), 'main!')

	// not present in index, fallback
	assertEquals(await Main.resolveEntrypoint(config, ['c']), {
		module: replaceSuffix(import.meta.url, 'test/main_test.ts', 'lib/chore/builtins.ts'),
		fn: 'c'
	})
}))
