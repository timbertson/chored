import { runOutput, run } from '../../lib/cmd.ts'

import * as Env from '../../lib/github/run_env.ts'

let fetched = false

export default async function(n: string) {
	// we're verifying details with git history, so
	// make sure we're not using a shallow clone
	if (!fetched) {
		await run(['git', 'fetch', '--unshallow'])
		console.log(Env)
		fetched = true
	}

	const output = (await runOutput(['git', 'name-rev', '--name-only', n])).trim()
	console.log('parsing ref: ', output)
	let parts = output.split('/')
	let type: string
	let name: string
	if (parts[0] === 'remotes') {
		// remove remotes/origin
		parts = parts.slice(2)
	}

	if (parts.length == 1) {
		type = 'branch'
		name = parts[0]
	} else if (parts[0] === 'tags') {
		type = 'tag'
		name = parts[1]
	} else {
		throw new Error("Invalid name-ref output: "+output)
	}
	return { name, type }
}
