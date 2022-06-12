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

import { describeVersion } from "../git.ts";
import { trimIndent } from "../util/string.ts";
import { defaulted } from "../util/function.ts";

export type { CliOptions as Options }

export function Make(defaults: Partial<CliOptions>) {
	async function print (opts: {
		ref?: string,
		devSuffix?: string | null
	}) {
		const parsed = await describeVersion({ ref: opts?.ref })
		if (parsed.version == null) {
			console.warn("No current version found")
			Deno.exit(1)
		}
		console.log(parsed.version.show())
	}

	const bump = defaulted(defaults, async (opts: CliOptions): Promise<Version|null> => {
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
				|| (opts.defaultTemplate ? VersionTemplate.parse(opts.defaultTemplate) : null)
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
	}, {
		help: trimIndent(`
			Compute and print/tag/push the next version tag.

			The version template is taken from the first defined in:
			 - versionTemplate
			 - an implicit version template based on the git branch
			   (only if it starts with v[0-9])
			 - defaultTemplate

			Options:
			  defaultComponent?: Index
			  component?: Index
			  action?: 'print' | 'tag' | 'push'
			  trigger?: 'always' | 'commitMessage'
			  versionTemplate?: string
			  defaultTemplate?: string

			defaults: ${JSON.stringify(defaultOptions)}`)
	})

	return {
		default: print,
		print,
		bump
	}
}
Make.isChoredef = false

const base = Make({})
export const { print, bump } = base
export default base.default
