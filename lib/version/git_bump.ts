import { Version, Index, namedIndexes, resolveIndex } from '../version.ts'
import { filterNull, sortBy } from '../util/collection.ts'
import { CmdRunner, describeWithAutoDeepen } from '../git/describe_impl.ts'

interface CommonOptions {
	defaultComponent?: Index
	component?: Index
	action: Action
	trigger: Trigger
}

export interface CliOptions extends Partial<CommonOptions> {
	versionTemplate?: string
	defaultTemplate?: string
}

export interface BumpOptions extends CommonOptions {
	versionTemplate: VersionTemplate
}

export const defaultOptions: CommonOptions = {
	action: 'tag',
	trigger: 'always',
}

// x: free
// -: pinned
// literal: pinned
type TemplatePart = 'x'|'-'|number

export type Action = 'print' | 'tag' | 'push'
export type Trigger = 'always' | 'commitMessage'

export class VersionTemplate {
	parts: Array<TemplatePart>
	minimalIndex: number
	isFree: (index: number) => boolean
	
	constructor(parts: Array<TemplatePart>) {
		this.parts = parts

		let firstFree = parts.indexOf('x')
		const lastFree = parts.lastIndexOf('x')
		if (firstFree === -1) {
			// allow no free parts, e.g v2 for v2.x.x
			firstFree = parts.length
			this.minimalIndex = firstFree
		} else {
			this.minimalIndex = lastFree

			// you can only have `x` or `0` after a free component
			const invalidPart = parts.slice(firstFree).find(part => !(part === 'x' || part === 0))
			if (invalidPart != null) {
				throw new Error(`Invalid version template: ${this.show()}`)
			}
		}

		this.isFree = (i: number) => i >= firstFree

		if (lastFree !== -1 && lastFree !== parts.length - 1) {
			// there's a terminated span, e.g. 1.x.0
			this.isFree = (i: number) => i >= firstFree && i <= lastFree
		}
	}
	
	static parsePart(p: string): TemplatePart {
		if (p === 'x' || p === '-') return p
		return Version.parsePart(p)
	}

	static parse(s: string): VersionTemplate {
		const parts = Version.split(s)
		return new VersionTemplate(parts.map(VersionTemplate.parsePart))
	}

	static parseLax(s: string): VersionTemplate|null {
		try {
			return VersionTemplate.parse(s)
		} catch(_: any) {
			return null
		}
	}

	static unrestricted(numComponents: number): VersionTemplate {
		const parts: TemplatePart[] = []
		while(parts.length < numComponents) {
			parts.push('x')
		}
		return new VersionTemplate(parts)
	}

	show(): string {
		return this.parts.join('.')
	}

	initialVersion(): Version {
		return new Version(this.parts.map(part =>
			(part === '-' || part === 'x') ? 0 : part
		))
	}
	
	extendTo(length: number) {
		const parts = this.parts.slice()
		while(parts.length < length) {
			parts.push('x')
		}
		return new VersionTemplate(parts)
	}
}

interface CommitDirective {
	release: boolean
	component: Index | null
}

export interface NextVersionOptions {
	defaultComponent?: Index
	component: Index | null
}

export function nextVersion(template: VersionTemplate, currentVersion: Version | null, options: NextVersionOptions): Version {
	let chosenIndex = template.minimalIndex
	if (options.component != null) {
		chosenIndex = resolveIndex(options.component)
		if (!template.isFree(chosenIndex)) {
			throw new Error(`Requested component (${options.component}) is incompatible with version template: ${template.show()}`)
		}
		console.log(`Using component from commit message: ${options.component}`)
	} else if (options.defaultComponent != null) {
		// upgrade to preferred component, if allowed
		const preferredIndex = options.defaultComponent
		if (template.isFree(resolveIndex(preferredIndex))) {
			console.log(`Using default component: ${preferredIndex}`)
			chosenIndex = resolveIndex(preferredIndex)
		}
	}
	
	if (currentVersion === null) {
		return template.initialVersion()
	} else {
		console.log(`Bumping version component ${chosenIndex}`)
		let incremented = false
		const parts = template.extendTo(chosenIndex+1).parts.map((t, i) => {
			const v = currentVersion.parts[i] ?? 0
			let part = incremented ? 0 : v
			if (i < chosenIndex) {
				if (!(t === '-' || t === 'x')) {
					part = t
					if (part > v) {
						incremented = true
					}
				}
			} else if (i == chosenIndex) {
				// if we've already incremented an earlier component,
				// don't increment this one
				part = incremented ? 0 : v+1
				incremented = true
			}
			return part
		})
		return new Version(parts)
	}
}

export interface Context {
	headRef: string
	mergeTargetRef: string
}

export const defaultContext: Context = {
	headRef: 'HEAD',
	mergeTargetRef: 'HEAD',
}

export class Engine {
	private runner: CmdRunner
	private ctx: Context

	constructor(runner: CmdRunner, ctx: Context = defaultContext) {
		this.runner = runner
		this.ctx = ctx
	}

	async bump(opts: BumpOptions): Promise<Version|null> {
		// For a PR, we find the last tag reachable from the base ref (the branch we're merging into),
		// rather than HEAD. Github creates the HEAD merge commit when you create / push a PR,
		// so it won't always contain everything in the target branch:
		//
		//   * master (v1.2.3)
		//   |
		//   |  * HEAD (PR auto merge commit)
		//   |/ |
		//   |  * PR: my cool feature
		//   | /
		//   * master^ (v1.2.2)
		//   |
		//   (...)
		//
		// If we just used HEAD, we'd pick a conflicting `v1.2.3` for this PR and fail,
		// even though once merged it would correctly pick v1.2.4
		//
		// In the case where you merge a version branch into master (i.e. both have version tags),
		// the PR will naturally only consider the master branch. Once merged, `--first-parent`
		// will ensure that `git describe` only searches the mainline history, not the version branch.
		const current = await describeWithAutoDeepen(this.runner, this.ctx.mergeTargetRef)

		let directive: CommitDirective = { component: null, release: false }
		let currentVersion: Version | null = null
		if (current.tag == null) {
			console.log("No current version detected")
		} else {
			currentVersion = Version.parse(current.tag)
			console.log("Current version: " + currentVersion?.show() + " (from tag "+current.tag+")")
			if (current.isExact) {
				console.log("Commit is already tagged")
				if (opts.action === 'push') {
					await this.push(currentVersion)
				}
				return null
			}
			directive = parseCommitLines(await this.commitLinesSince(current.tag))
			console.log("Commit directive:", directive)
		}
		
		const version = nextVersion(
			opts.versionTemplate,
			currentVersion,
			{ component: opts.component || directive.component, defaultComponent: opts.defaultComponent }
		)

		const trigger = opts.trigger
		const action = opts.action
		if (trigger === 'always' || directive.release) {
			await this.applyVersion(action, version)
			return version
		} else {
			console.log("No version bump required")
			return null
		}
	}

	async push(version: Version) {
		const tag = version.tag()
		console.log("Pushing: "+ tag)
		await this.runner.run(['git', 'push', 'origin', 'tag', tag])
	}

	async applyVersion(action: Action, version: Version) {
		const tag = version.tag()
		if (action === 'print') {
			console.log("Calculated tag: "+ tag)
		} else {
			console.log("Tagging: "+ tag)
			await this.runner.run(['git', 'tag', tag, 'HEAD'])
			if (action === 'push') {
				await this.push(version)
			}
		}
	}

	private commitLinesSince(tag: string): Promise<string> {
		// if we're running on a PR, use the head ref (branch to be merged)
		// instead of the HEAD (which is actually a merge of the PR against `master`)
		return this.runner.runOutput(['git', 'log', '--format=format:%s', tag + '..' + this.ctx.headRef, '--'])
	}
}

export function parseCommitLines(commitLines: string): CommitDirective {
	function parse(label: string): CommitDirective {
		const withoutRelease = label.replace(/-release$/, "")
		if (namedIndexes.includes(withoutRelease)) {
			return {
				component: withoutRelease as Index,
				release: withoutRelease !== label
			}
		} else {
			return {
				component: null,
				release: label === 'release'
			}
		}
	}

	if (commitLines.length == 0) {
		return { release: false, component: null }
	}
	const tags = commitLines.match(/\[\S+\]/gm) || []
	// console.log("tags: " + JSON.stringify(tags))
	const labels = (tags
		.map((tag) => tag.trim().replace(/\[|\]/g, ''))
		.map(parse)
	)
	// console.log(JSON.stringify(commitLines) + ' => ' + JSON.stringify(labels))

	return {
		release: labels.find((desc) => desc.release) != null,
		component: sortBy(filterNull(labels.map((d) => d.component)), resolveIndex)[0] ?? null
	}
}

