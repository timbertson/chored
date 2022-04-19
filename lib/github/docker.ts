import * as Env from './run_env.ts'
import * as Git from '../git.ts'
import { Spec } from "../docker/file.ts";
import notNull from "../util/not_null.ts";
import dedupe from "../util/dedupe.ts";
import { buildAll, BuildOptions, TagStrategy } from "../docker/build.ts";

type Options = BuildOptions & { mainBranchName?: string }

export interface GithubEnv {
	pushedBranch: string | null,
	pullRequestBranch: string | null,
	pullRequestTarget: string | null,
	triggerRefName: string | null,
	triggerCommitSHA: string | null,
	isCI: boolean
}

export async function _buildOptions(Env: GithubEnv, build: Options = {}): Promise<TagStrategy & BuildOptions> {
	let tags = ['development']

	// In github, we cache from:
	// - the main branch
	const maybeCacheFrom: Array<string|null> = [ 'latest' ]

	if (Env.isCI) {
		tags = [
			notNull(Env.triggerCommitSHA),
		]

		if (Env.pullRequestBranch !== null) {
			maybeCacheFrom.push(Env.pullRequestBranch, Env.pullRequestTarget)
			tags.push(notNull(Env.pullRequestBranch))
		} else {
			tags.push(notNull(Env.triggerRefName))
			maybeCacheFrom.push(Env.triggerRefName)
		}
		
		// Sure would be nice if github exposed this in an envvar or something :/
		const mainBranches = build.mainBranchName ? [ build.mainBranchName ] : [ 'main', 'master' ]
		if (Env.pushedBranch && mainBranches.indexOf(Env.pushedBranch) !== -1) {
			tags.push('latest')
		}
	} else {
		maybeCacheFrom.push('latest', await Git.branchName())
	}
	
	const cacheFrom = dedupe(maybeCacheFrom.flatMap(x => x != null ? [x] : []))
	return { tags, cacheFrom , push: Env.isCI, ...build }
}

export async function standardBuild(spec: Spec, build: Options = {}): Promise<void> {
	await buildAll(spec, await _buildOptions(Env, build))
}
