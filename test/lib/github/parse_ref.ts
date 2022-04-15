import { runOutput, run } from '../../../lib/cmd.ts'
import notNull from '../../../lib/util/not_null.ts'

let fetched = false

export default async function(n: string) {
	// fight against shallow checkout
	if (!fetched) {
		const rev = (await runOutput(['git', 'rev-parse', 'HEAD'])).trim()
		await run(['git', 'fetch', '--depth', '4', 'origin', rev, notNull(Deno.env.get('GITHUB_REF'))])
		await run(['git', 'log', '--graph', '-n', '4'])
		fetched = true
	}

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
