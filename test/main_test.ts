import { assertEquals, assertThrows, assertRejects, assertMatch } from './common.ts'
import { DenoFS, FakeFS } from '../lib/fs/impl.ts'
import { run } from '../lib/cmd.ts'
import withTempDir from '../lib/fs/with_temp_dir.ts'
import * as Main from '../main.ts'
import { Config, defaultConfig } from '../lib/chored_config.ts'
import { replaceSuffix } from '../lib/util/string.ts'

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

interface MinimalEntrypoint {
	module: string,
	fn: string,
	viaDefault: boolean,
}

async function resolveEntrypoint(c: Config, main: string[]): Promise<MinimalEntrypoint|Main.NoSuchEntrypoint> {
	const r = await Main.resolveEntrypoint(c, main)
	if (Main.isEntrypointFound(r)) {
		return {
			module: r.module,
			fn: r.fn,
			viaDefault: r.viaDefault
		}
	}
	return r
}

Deno.test("run", () => withTempDir({}, async (dir) => {
	await DenoFS.writeTextFile(`${dir}/a.ts`, `
		export default function(opts: {}) { return "chore a!" }
		export function async(opts: {}) { return Promise.resolve("chore a (async)!") }
	`)

	await DenoFS.writeTextFile(`${dir}/dynamic.ts`, `
		function module() {
			return { impl: function(opts: {}) { return "dynamic!" } }
		}
		export default module()
	`)

	await DenoFS.writeTextFile(`${dir}/index.ts`, `
		export function b(opts: {}) { return "index b!" }
		export default function(opts: {}) { return "main!" }
	`)

	const moduleURI = (name: string) => `file://${dir}/${name}.ts`
	const config: Config = { ...defaultConfig, taskRoot: dir }

	assertEquals(await Main.run(config, ['a'], {}), 'chore a!')
	assertEquals(await Main.run(config, ['a', 'async'], {}), 'chore a (async)!')

	assertEquals(await resolveEntrypoint(config, ['b']), {
		module: moduleURI('index'), fn: 'b', viaDefault: false
	})
	assertEquals(await Main.run(config, ['b'], {}), 'index b!')
	assertEquals(await Main.run(config, [], {}), 'main!')

	assertEquals(await Main.run(config, ['dynamic', 'impl'], {}), 'dynamic!')

	// not present in index, fallback
	const notFoundError = await resolveEntrypoint(config, ['c']) as Main.NoSuchEntrypoint
	assertMatch(notFoundError.candidates.join('\n'), /index.ts symbol 'c', found \["b","default"\]/)
	assertMatch(notFoundError.candidates.join('\n'), /lib\/chore\/builtins.ts symbol 'c'/)
}))
