import { assertEquals, assertRejects } from '../common.ts'
import { run, runTest, runOutput } from '../../lib/cmd.ts'

const noPrint = { printCommand: false }

Deno.test("cmd fails on nonzero stautus", async () => {
	await run(['true'], noPrint)
	await assertRejects(() => run(['false'], noPrint), undefined, "Command `false` failed with status 1")
})

Deno.test("cmd runTest", async () => {
	assertEquals(await runTest(['true'], noPrint), true)
	assertEquals(await runTest(['false'], noPrint), false)
})

Deno.test("cmd output", async () => {
	assertEquals((await runOutput(['echo', '1\n2'], noPrint)), '1\n2')
	
	const outAndErr = async () => {
		const p = await run(['bash', '-c', 'echo "1\n2"; echo >&2 "3\n4"'], { ... noPrint, stderr: 'string', stdout: 'string' })
		return { out: p.output, err: p.errOutput }
	}
	assertEquals(await outAndErr(), { out: '1\n2', err: '3\n4' })
})

Deno.test("cmd pipeLines", async () => {
	let lines: Array<string> = []
	const pushLine = (l: string) => lines.push(l)
	await run(['bash', '-c', 'echo "1\n2\n3\n4"'], { stdout: pushLine, printCommand: false })
	assertEquals(lines, ['1','2','3','4'])

	lines = []
	await run(['bash', '-c', 'echo >&2 "5\n6\n7\n8"'], { stderr: pushLine, printCommand: false })
	assertEquals(lines, ['5','6','7','8'])
})
