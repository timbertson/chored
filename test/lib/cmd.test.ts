import { assertEquals, assertRejects } from '../common.ts'
import { run, runTest, runOutput } from '../../lib/cmd.ts'

Deno.test("cmd fails on nonzero stautus", async () => {
	await run(['true'])
	await assertRejects(() => run(['false']), undefined, "Command `false` failed with status 1")
})

Deno.test("cmd runTest", async () => {
	assertEquals(await runTest(['true']), true)
	assertEquals(await runTest(['false']), false)
})

Deno.test("cmd output", async () => {
	assertEquals((await runOutput(['echo', '1\n2'])), '1\n2')
})

Deno.test("cmd pipeLines", async () => {
	const lines: Array<string> = []
	const pushLine = (l: string) => lines.push(l)
	await run(['bash', '-c', 'echo "1\n2\n3\n4"'], { stdio: { pipeLines: pushLine } })
	assertEquals(lines, ['1','2','3','4'])
})
