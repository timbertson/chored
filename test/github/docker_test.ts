import { assertEquals } from "../common.ts";

import { _buildOptions, GithubEnv } from "../../lib/github/docker.ts";
import * as Git from "../../lib/git.ts"
import { notNull } from "../../lib/util/object.ts";

const sha = 'abcd123'

const baseEnv = {
	pushedBranch: null,
	pullRequestBranch: null,
	pullRequestTarget: null,
	triggerRefName: null,
	triggerCommitSHA: null,
}

Deno.test('buildOptions dev', async () => {
	const devEnv: GithubEnv = {
		...baseEnv,
		isCI: false,
	}

	assertEquals(await _buildOptions(devEnv, {}),
		{
			cacheFrom: [ "latest", notNull(await Git.branchName()) ],
			push: false,
			tags: [ "development" ],
		}
	)
})

Deno.test('buildOptions push', async () => {
	function pushEnv(branch: string): GithubEnv {
		return {
			...baseEnv,
			isCI: true,
			pushedBranch: branch,
			triggerRefName: branch,
			triggerCommitSHA: sha,
		}
	}

	assertEquals(await _buildOptions(pushEnv('pushed-branch'), {}),
		{
			cacheFrom: [ "latest", "pushed-branch" ],
			push: true,
			tags: [ sha, 'pushed-branch' ],
		}
	)

	assertEquals(await _buildOptions(pushEnv('main'), {}),
		{
			cacheFrom: [ "latest", "main" ],
			push: true,
			tags: [ sha, "main", "latest" ],
		}
	)
})

Deno.test('buildOptions pull request', async () => {
	const prEnv: GithubEnv = {
		...baseEnv,
		isCI: true,
		pullRequestBranch: 'pr-branch',
		pullRequestTarget: 'v1',
		triggerRefName: 'prNumber/merge',
		triggerCommitSHA: sha,
	}


	assertEquals(await _buildOptions(prEnv, {}),
		{
			cacheFrom: [ 'latest', 'pr-branch', 'v1' ],
			push: true,
			tags: [ sha, "pr-branch" ],
		}
	)
})
