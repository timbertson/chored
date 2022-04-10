import * as render from './render.ts'
import * as test from './test.ts'
import { requireCleanAround } from '../lib/git.ts'

export async function main(opts: { requireClean?: boolean }) {
	// const action = () => Promise.all([
	// 	test.main({}),
	// 	render.main({}),
	// ])
	const action = (): Promise<void> => {
		console.warn("TESTING")
		return Promise.resolve()
	}

	const requireClean = opts.requireClean === true
	return requireClean ? requireCleanAround('./chored precommit', action) : action()
}
