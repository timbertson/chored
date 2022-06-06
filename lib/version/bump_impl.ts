import { Version, Index, namedIndexes, resolveIndex } from '../version.ts'
import { filterNull, sort, sortBy } from '../util/collection.ts'

export interface BumpOptions {
	versionTemplate: VersionTemplate
	defaultBump?: Index
	action?: Action
	trigger?: Trigger
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
	index: Index | null
}

export interface NextVersionOptions {
	defaultBump?: Index
	index: Index | null
}

export function nextVersion(template: VersionTemplate, currentVersion: Version | null, options: NextVersionOptions): Version {
	let chosenIndex = template.minimalIndex
	if (options.index != null) {
		chosenIndex = resolveIndex(options.index)
		if (!template.isFree(chosenIndex)) {
			throw new Error(`Requested index (${options.index}) is incompatible with version template: ${template.show()}`)
		}
		console.log(`Using index from commit message: ${options.index}`)
	} else if (options.defaultBump != null) {
		// upgrade to preferred index, if allowed
		const preferredIndex = options.defaultBump
		if (template.isFree(resolveIndex(preferredIndex))) {
			console.log(`Using default index: ${preferredIndex}`)
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

export interface CmdRunner {
	run(cmd: string[]): Promise<void>
	runOutput(cmd: string[], opts?: { allowFailure?: boolean }): Promise<string>
	exists(path: string): Promise<boolean>
}

export interface Context {
	headRef: string
	mergeTargetRef: string
}

export const defaultContext: Context = {
	headRef: 'HEAD',
	mergeTargetRef: 'HEAD',
}

interface DescribedVersion {
	version: Version
	tag: string
	isExact: boolean
}

export class Engine {
	private runner: CmdRunner
	private ctx: Context

	constructor(runner: CmdRunner, ctx: Context = defaultContext) {
		this.runner = runner
		this.ctx = ctx
	}

	async bump(opts: BumpOptions): Promise<Version|null> {
		const current = await this.describeWithAutoDeepen()

		let directive: CommitDirective = { index: null, release: false }
		if (current == null) {
			console.log("No current version detected")
		} else {
			console.log("Current version: " + (current.version) + " (from tag "+current.tag+")")
			if (current.isExact) {
				console.log("Commit is already tagged")
				return null
			}
			directive = parseCommitLines(await this.commitLinesSince(current.tag))
			console.log("Commit directive:", directive)
		}
		
		const version = nextVersion(
			opts.versionTemplate,
			current?.version ?? null,
			{ index: directive.index, defaultBump: opts.defaultBump }
		)

		const trigger = opts.trigger ?? 'always'
		const action = opts.action ?? 'tag'
		if (trigger === 'always' || directive.release) {
			await this.applyVersion(action, version)
			return version
		} else {
			console.log("No version bump required")
			return null
		}
	}

	static parseGitDescribe(output: string): DescribedVersion | null {
		const parts = output.split('-')
		if (parts.length == 1) {
			// just a git commit
			return null
		} else if (parts.length > 2) {
			// output is e.g. v1.3.0-3-gf32721e
			let tag = parts.slice(0, parts.length - 2).join('-')
			let depth = parts[parts.length - 2]
			return {
				tag: tag,
				version: Version.parse(tag),
				isExact: depth == '0',
			}
		} else {
			throw new Error("Unexpected `git describe` output: " + output)
		}
	}

	async applyVersion(action: Action, version: Version) {
		let tag = version.tag()
		if (action === 'print') {
			console.log("Calculated tag: "+ tag)
		} else {
			console.log("Tagging: "+ tag)
			await this.runner.run(['git', 'tag', tag, 'HEAD'])
			if (action === 'push') {
				console.log("Pushing: "+ tag)
				await this.runner.run(['git', 'push', 'origin', 'tag', tag])
			}
		}
	}

	private commitLinesSince(tag: string): Promise<string> {
		// if we're running on a PR, use the head ref (branch to be merged)
		// instead of the HEAD (which is actually a merge of the PR against `master`)
		return this.runner.runOutput(['git', 'log', '--format=format:%s', tag + '..' + this.ctx.headRef, '--'])
	}

	// https://stackoverflow.com/questions/56477321/can-i-make-git-fetch-a-repository-tag-list-without-actually-pulling-the-commit-d
	// The docs say this simple approach doesn't work, but.. the docs are wrong in our favour?
	// https://lore.kernel.org/git/CAC-LLDiu9D7Ea-HaAsR4GO9PVGAeXOc8aRoebCFLgDKow=hPTQ@mail.gmail.com/T/
	// TODO if this doesn't work, we can `ls-remote` to get tags, then `git merge-base --is-ancestor candidate HEAD.
	// But remote tags might be huge, so we'll try and get away without that
	async describeWithAutoDeepen(): Promise<DescribedVersion|null> {
		const self = this
		async function describe(): Promise<DescribedVersion|null> {
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

			// So we don't trip on any tags which happen to begin with `v`, we require at least one digit
			const matchFlags = [0,1,2,3,4,5,6,7,8,9].flatMap(n => ['--match', `v${n}*`])
			const describeOutput = await self.runner.runOutput(
				['git', 'describe', '--tags', '--first-parent', ]
				.concat(matchFlags).
				concat(['--always', '--long', self.ctx.mergeTargetRef]),
				{ allowFailure: true }
			)
			console.log("Git describe output: "+ describeOutput)
			return Engine.parseGitDescribe(describeOutput)
		}

		async function loop(tries: number): Promise<DescribedVersion|null> {
			const ret = await describe()
			if (ret != null || tries < 1) {
				return ret
			} else {
				// on the last attempt, we do a full clone
				const cmd = tries == 1 ? ['git', 'fetch', '--unshallow', '--tags'] : ['git', 'fetch', '--deepen', '100']
				console.log("Fetching more history ...")
				self.runner.run(cmd)
				return loop(tries - 1)
			}
		}

		if (await this.runner.exists(".git/shallow")) {
			console.log("Shallow repository detected")
			return await loop(4)
		} else {
			return describe()
		}
	}
}

export function parseCommitLines(commitLines: string): CommitDirective {
	function parse(label: string): CommitDirective {
		let withoutRelease = label.replace(/-release$/, "")
		if (namedIndexes.includes(withoutRelease)) {
			return {
				index: withoutRelease as Index,
				release: withoutRelease !== label
			}
		} else {
			return {
				index: null,
				release: label === 'release'
			}
		}
	}

	if (commitLines.length == 0) {
		return { release: false, index: null }
	}
	let tags = commitLines.match(/\[\S+\]/gm) || []
	// console.log("tags: " + JSON.stringify(tags))
	let labels = (tags
		.map((tag) => tag.trim().replace(/\[|\]/g, ''))
		.map(parse)
	)
	// console.log(JSON.stringify(commitLines) + ' => ' + JSON.stringify(labels))

	return {
		release: labels.find((desc) => desc.release) != null,
		index: sortBy(filterNull(labels.map((d) => d.index)), resolveIndex)[0] ?? null
	}
}

