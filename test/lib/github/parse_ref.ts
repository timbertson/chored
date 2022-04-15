import { runOutput, run } from '../../../lib/cmd.ts'

export default async function(n: string) {
	await run(['git', 'log', '--graph', '-n', '4'])
	const output = await runOutput(['git', 'name-rev', n])
	const parts = output.trim().split(/\s+/)[1].split('/')
	if (parts.length < 3) {
		throw new Error("Invalid name-ref output: "+output)
	}
	return {
		name: parts[parts.length-1],
		type: parts[parts.length-2],
	}
}
