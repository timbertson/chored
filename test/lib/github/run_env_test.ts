import { assertEquals } from '../../common.ts'
import { runOutput } from '../../../lib/cmd.ts'

import * as Env from '../../../lib/github/run_env.ts'

async function parseRef(n: string) {
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

// This is a bit silly: we can only see what GH provides within the appropriate event,
// so these tests can't run in any other context :/
if (Env.isCI) {
	if (Env.isPullRequest) {
		Deno.test('PR context', async () => {
			// GH pulls always run on a merge commit, pull it out from git to cross-check
			assertEquals(Env.pullRequestBranch, (await parseRef('HEAD^1')).name)
			assertEquals(Env.pullRequestTarget, (await parseRef('HEAD^2')).name)
		})
	} else if (Env.isPush) {
		Deno.test('push context', async () => {
			const ref = await parseRef('HEAD')
			if (Env.refType === 'branch') {
				assertEquals(Env.pushedBranch, ref.name)
				assertEquals(Env.pushedTag, null)
			} else {
				assertEquals(Env.pushedBranch, null)
				assertEquals(Env.pushedTag, ref.name)
			}
		})
	}
}
