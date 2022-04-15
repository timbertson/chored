import { assertEquals } from '../../common.ts'
import parseRef from './parse_ref.ts'

import * as Env from '../../../lib/github/run_env.ts'

// This is a bit silly: we can only see what GH provides within the appropriate event,
// so these tests can't run in any other context :/
Deno.test('run_env push context', async () => {
	const ref = await parseRef('HEAD')
	assertEquals(Env.refType, ref.type)
	if (Env.refType === 'branch') {
		assertEquals(Env.pushedBranch, ref.name)
		assertEquals(Env.pushedTag, null)
	} else {
		assertEquals(Env.pushedBranch, null)
		assertEquals(Env.pushedTag, ref.name)
	}
})
