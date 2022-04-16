
import * as GH from '../../../lib/github/api.ts'
import { assertEquals } from "../../../test/common.ts";

const client = GH.defaultClient()

Deno.test('createOrUpdatePullRquest', async () => {
	// NOTE: we don't execute the create / close code path after initial run, as it'd create a lot of PR churn
	const pr = await client.createOrUpdatePullRquest({
		owner: 'timbertson',
		repo: 'chored',
		baseBranch: 'main',
		branchName: 'test-branch-2',
		title: "[ignore] test PR",
		body: "This is a test PR used in integration tests, ignore me"
	})
	assertEquals(pr, {
		id: "PR_kwDOHHJlic42UAxv",
		number: 4,
		url: "https://github.com/timbertson/chored/pull/4",
	})
})
