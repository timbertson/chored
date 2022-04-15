import { runOutput, run } from '../../../lib/cmd.ts'
import notNull from '../../../lib/util/not_null.ts'

let fetched = false

export default async function(n: string) {
	// fight against shallow checkout
	if (!fetched) {
		await run(['git', 'fetch', '--unshallow'])
		fetched = true
	}

	const output = await runOutput(['git', 'name-rev', n])
	const parts = output.trim().split(/\s+/)[1].split('/')
	if (parts.length < 3) {
		throw new Error("Invalid name-ref output: "+output)
	}
	console.log('parsing ref: ', output)
	return {
		name: parts[parts.length-1],
		type: parts[1],
	}
}
