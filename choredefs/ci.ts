import render from './render.ts'
import test from './test.ts'
import { requireCleanAroundIf } from '../lib/git.ts'

export default async function(opts: { requireClean?: boolean }) {
	await requireCleanAroundIf(opts.requireClean === true, { description: './chored precommit', includeUntracked: true }, async () => {
		await Promise.all([
			test({}),
			render({}),
		])
	})
}
