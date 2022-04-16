import * as render from './render.ts'
import * as test from './test.ts'
import { requireCleanAround } from '../lib/git.ts'

export async function main(opts: { requireClean?: boolean }) {
	const action = async () => {
		await Promise.all([
			test.main({}),
			render.main({}),
		])
	}

	const requireClean = opts.requireClean === true
	return requireClean ? requireCleanAround({ description: './chored precommit', includeUntracked: true }, action) : action()
}
