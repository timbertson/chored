import {
	CliOptions,
	BumpOptions,
	Engine,
	VersionTemplate,
	defaultContext,
	defaultOptions,
	Action
} from '../version/git_bump.ts'
import { Version } from '../version.ts'
import * as GH from '../github/run_env.ts'
import * as Git from '../git.ts'
import { notNull } from "../util/object.ts";
import runner from '../../lib/git/deno_runner.ts'

export { Version }
export type { CliOptions as Options }

export default async function bump(opts: CliOptions): Promise<Version|null> {
	let versionTemplate: VersionTemplate | null = null
	let ctx = defaultContext
	let implicitVersionTemplate = () => Git.branchName()
	let action: Action = opts.action ?? defaultOptions.action
	
	if (GH.isPullRequest) {
		function originRefOrHead(ref: string|null) {
			return ref == null ? 'HEAD' : `origin/${ref}`
		}
		ctx = {
			headRef: originRefOrHead(GH.pullRequestBranch),
			mergeTargetRef: originRefOrHead(GH.pullRequestTarget),
		}
		console.log("Github context: ", ctx)
		implicitVersionTemplate = async () => {
			return GH.pushedBranch || GH.pullRequestTarget || await Git.branchName()
		}
		if (GH.isPullRequest && action === 'push') {
			//never push from a PR
			action = 'tag'
		}
	}
	
	// explicit template:
	if (opts.versionTemplate != null) {
		versionTemplate = VersionTemplate.parse(opts.versionTemplate)
	} else {
		function tryTemplate(s: string | null): VersionTemplate|null {
			if (s == null) {
				return null
			}
			const candidate = VersionTemplate.parseLax(s)
			if (candidate == null) {
				console.log(`Ignoring fallback versionTemplate: ${s}`)
			}
			return candidate
		}
		versionTemplate = (
			tryTemplate(await implicitVersionTemplate())
			|| tryTemplate(opts.defaultTemplate ?? null)
			|| VersionTemplate.unrestricted(3)
		)
	}

	const bumpOpts: BumpOptions = {
		action,
		trigger: opts.trigger ?? defaultOptions.trigger,
		versionTemplate: notNull(versionTemplate)
	}
	console.log('Computed bump options: ' + JSON.stringify(bumpOpts))
	return await new Engine(runner({}), ctx).bump(bumpOpts)
}
