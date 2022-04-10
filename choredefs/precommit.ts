import * as render from './render.ts'
import * as test from './test.ts'
import * as lock from '../lib/chores/lock.ts'
import { requireCleanAround } from '../lib/git.ts'

export async function main(opts: { requireClean?: boolean }) {
	const action = async () => Promise.all([
		test.main({}),
		render.main({}),
		lock.main({}),
	])

	const requireClean = opts.requireClean === true
	return requireClean ? requireCleanAround({ description: './chored precommit', includeUntracked: true }, action) : action()
}
