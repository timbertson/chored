import { assertEquals } from '../common.ts'
import parseRef from './parse_ref.ts'

import * as Env from '../../lib/github/run_env.ts'

Deno.test('run_env PR context', async () => {
	// GH pulls always run on a merge commit, pull it out from git to cross-check.
	// GH merges PR into target, so HEAD^s is the mainline
	assertEquals(Env.pullRequestBranch, (await parseRef('HEAD^2')).name)
	assertEquals(Env.pullRequestTarget, (await parseRef('HEAD^1')).name)
})
