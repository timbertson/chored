import * as Env from './run_env.ts'
import * as Git from '../git.ts'
import { Spec } from "../docker/file.ts";
import { notNull } from '../util/object.ts'
import { dedupe } from "../util/collection.ts";
import { buildAllFromSpec, BuildOptions, TagStrategy, MinimalSpec, MinimalStage, _applyTag } from "../docker/build.ts";
import { Image } from "../docker/image.ts";

type Options = BuildOptions & { mainBranchName?: string }

export interface GithubEnv {
	pushedBranch: string | null,
	pullRequestBranch: string | null,
	pullRequestTarget: string | null,
	triggerRefName: string | null,
	triggerCommitSHA: string | null,
	isCI: boolean
}

function primaryTag(Env: GithubEnv): string {
	return (Env.isCI) ? notNull(Env.triggerCommitSHA) : 'development'
}

export async function _buildOptions(Env: GithubEnv, build: Options = {}): Promise<TagStrategy & BuildOptions> {
	let secondaryTags: string[] = []

	// In github, we cache from:
	// - the main branch
	const maybeCacheFrom: Array<string|null> = [ 'latest' ]

	if (Env.isCI) {
		if (Env.pullRequestBranch !== null) {
			maybeCacheFrom.push(Env.pullRequestBranch, Env.pullRequestTarget)
			secondaryTags.push(notNull(Env.pullRequestBranch))
		} else {
			secondaryTags.push(notNull(Env.triggerRefName))
			maybeCacheFrom.push(Env.triggerRefName)
		}
		
		// Sure would be nice if github exposed this in an envvar or something :/
		const mainBranches = build.mainBranchName ? [ build.mainBranchName ] : [ 'main', 'master' ]
		if (Env.pushedBranch && mainBranches.indexOf(Env.pushedBranch) !== -1) {
			secondaryTags.push('latest')
		}
	} else {
		maybeCacheFrom.push(await Git.branchName())
	}
	
	const cacheFrom = dedupe(maybeCacheFrom.flatMap(x => x != null ? [x] : []))
	const tags = [ primaryTag(Env) ].concat(secondaryTags)
	return { tags, cacheFrom , push: Env.isCI, ...build }
}

export function imageForStage(spec: MinimalSpec, stageSpec: MinimalStage | number | 'last' = 'last'): Image {
	let stage: MinimalStage
	if (stageSpec === 'last') {
		stageSpec = spec.stages.length - 1
	}
	if (typeof(stageSpec) === 'number') {
		stage = notNull(spec.stages[stageSpec])
	} else {
		stage = stageSpec as MinimalStage
	}
	return _applyTag(primaryTag(Env), spec, stage)
}

export async function standardBuild(spec: Spec, build: Options = {}): Promise<void> {
	await buildAllFromSpec(spec, await _buildOptions(Env, build))
}
