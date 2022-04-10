import { assertEquals, assertThrows } from './common.ts'
import { FakeFS } from '../lib/fs/impl.ts'
import { run } from '../lib/cmd.ts'
import withTempDir from '../lib/fs/with_temp_dir.ts'
import * as Main from '../main.ts'

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
		assertEquals(readdir(testDir + '/choredefs'), ['index.ts', 'render.ts'])

		// test the generated project runs
		await run([`${testDir}/chored`, 'render'], {
			cwd: testDir,
			printCommand: false
		})
	})
})

Deno.test("resolveEntrypoint", async () => {
	const config = Main.defaultConfig()
	const base = config.taskRoot
	const resolve = (args: Array<string>) => Main.resolveEntrypoint(Main.defaultConfig(), args, fs)

	const fs = new FakeFS()
	await fs.writeTextFile(`${base}/render.ts`, '')

	assertEquals(resolve(['render']), { fn: 'main', module: base + '/render.ts' })

	// initially there's no index, so unknown actions are rejected
	assertThrows(() => resolve(['foo']), undefined, "Couldn't find a typescript module for foo")

	// with index, unknown action are assumed to be functions
	await fs.writeTextFile(`${base}/index.ts`, '')
	assertEquals(resolve(['foo']), { fn: 'foo', module: base + '/index.ts' })
	assertEquals(resolve(['foo', 'bar']), { fn: 'bar', module: base + '/foo.ts' })
})
