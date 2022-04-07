import { assertEquals } from './common.ts'
import { denonBinText } from '../lib/render/denonBin.ts'
import { run } from '../lib/cmd.ts'

// TODO:

// bootstrap
// module resoluation
// argument parsing
// run a real action

Deno.test("bootstrap", async () => {
	const here = Deno.cwd()
	const mainModule = `file://${here}/main.ts`
	const testDir = await Deno.makeTempDir({ prefix: 'denon-test-' })
	try {
		// NOTE: we should simplify this by producing an explicit bootstrap script
		await run(['bash', '-c', `cat ${here}/denon | env DENON_MAIN='${mainModule}' bash /dev/stdin --boot`], {
			cwd: testDir,
			printCommand: false,
			stdout: 'discard',
		})
		
		const readdir = (p: string) => {
			const ret = Array.from(Deno.readDirSync(p)).map(entry => entry.name)
			ret.sort()
			return ret
		}
		assertEquals(readdir(testDir), ['.gitattributes', 'denon', 'denon-tasks'])
		assertEquals(readdir(testDir + '/denon-tasks'), ['render.ts'])

		// test the generated project runs
		await run([`${testDir}/denon`, 'render'], {
			cwd: testDir,
			printCommand: false
		})
	} finally {
		await run(['rm', '-rf', testDir], { printCommand: false })
	}
})
