import render from './render.ts'
import test from './test.ts'
import { requireCleanAround } from '../lib/git.ts'

export default async function(opts: { requireClean?: boolean }) {
	const action = async () => {
		await Promise.all([
			test({}),
			render({}),
		])
	}

	const requireClean = opts.requireClean === true
	return requireClean ? requireCleanAround({ description: './chored precommit', includeUntracked: true }, action) : action()
}
