import { assertEquals } from './common.ts'
import { run } from '../lib/cmd.ts'
import withTempDir from '../lib/fs/with_temp_dir.ts'

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
