import notNull from './notNull.ts'
import { run } from './cmd.ts'
/*
 * parse imports
 *
 * bump strategy
 *  - github
 *  - deno land
 *  - std
 *
 * For github, we can specify a branch after the hash
 * https://.../mod.ts#master
 */

interface Source {
	cacheId(): string,
	resolve(): Promise<string|null>
}

export interface GithubImport {
	prefix: string,
	path: string,
	version: string,
	spec: string | null,
	owner: string,
	repo: string,
}

export class GithubSource implements Source {
	imp: GithubImport
	constructor(imp: GithubImport) {
		this.imp = imp
	}
	
	cacheId(): string {
		return this.addSpec(`github:${this.imp.owner}/${this.imp.repo}`)
	}
	
	private addSpec(s: string) {
		if (this.imp.spec) {
			return s + '#' + this.imp.spec
		} else {
			return s
		}
	}
	
	formatVersion(version: string) {
		const imp = this.imp
		return this.addSpec(`${imp.prefix}/${imp.owner}/${imp.repo}/${version}/${imp.path}`)
	}
	
	async resolve(): Promise<string|null> {
		// TODO: use https if there's known creds, otherwise ssh?
		const repo = `git@github.com:${this.imp.owner}/${this.imp.repo}.git}`
		return this.resolveFrom(repo)
	}

	async resolveFrom(repo: string): Promise<string|null> {
		const latest = await GithubSource.resolveLatest(repo, this.imp.spec)
		if (latest === null || latest === this.imp.version) {
			// not found or unchanged
			return null
		}
		return this.formatVersion(latest)
	}
	
	static async resolveLatest(repo: string, ref: string | null): Promise<string|null> {
		let refs: Array<Ref> = []
		const refFilter = ref || 'v*'
		function processLine(line: string) {
			refs.push(parseRef(line))
		}
		const cmd = ['git', 'ls-remote']
		const isWildcard = refFilter.lastIndexOf('*') >= 0

		if (isWildcard) {
			// grab only version-ish tags
			cmd.push('--tags')
		} else {
			// grab all refs, because we've got a specific ref
			cmd.push('--tags', '--heads')
		}
		cmd.push(repo, refFilter)

		await run(cmd, { stdout: processLine, printCommand: false })
		if (refs.length == 0) {
			return null
		}
		if (ref != null && !isWildcard) {
			refs = refs.filter(r => r.name === ref)
			if (refs.length == 0) {
				console.warn(`WARN: no matches for '${ref}' in ${repo}`)
				return null
			} else if (refs.length > 1) {
				console.warn(`WARN: ${refs.length} matches for '${ref}' in ${repo}`)
			}
			return refs[0].commit
		} else {
			// TODO version-sort
			return refs.length > 0 ? refs[refs.length-1].commit : null
		}
	}
}

export interface Ref {
	name: string,
	commit: string,
}

export function parseRef(line: string): Ref {
	let [commit, name] = line.split('\t', 2)
	// remove refs/heads, refs/tags, etc
	name = name.replace(/^refs\/[^/]+\//, '')
	return { commit, name }
}

export function parseGH(url: string): GithubSource | null {
	const gh = url.match(/^(https:\/\/raw\.githubusercontent\.com)\/([^/]+)\/([^/]+)\/([^/]+)\/([^#]+)(#(.+))?$/)
	if (gh !== null) {
		const [_match, prefix, owner, repo, version, path, _hash, spec] = gh
		return new GithubSource({
			owner: notNull('owner', owner),
			repo: notNull('repo', repo),
			prefix: notNull('prefix', prefix),
			version: notNull('version', version),
			spec: spec ? spec : null,
			path: notNull('path', path),
		})
	}
	
	return null
}

function parse(url: string): Source | null {
	return parseGH(url)
}

export class Bumper {
	private static dot = new TextEncoder().encode('.')

	private cache: { [index: string]: Promise<string|null> } = {}
	private fetchCount: number = 0
	private changeCount: number = 0

	async bump(url: string): Promise<string|null> {
		const source = parse(url)
		if (source == null) {
			return null
		}
		return this.bumpSource(source)
	}
	
	async bumpSource(source: Source): Promise<string|null> {
		const id = source.cacheId()
		let cached = this.cache[id]
		if (cached == null) {
			cached = this.cache[id] = source.resolve().then(r => {
				if (r !== null) {
					this.changeCount++
				}
				return r
			})
			this.fetchCount++
			await Deno.stdout.write(Bumper.dot)
		}
		return cached
	}

	summarize() {
		console.log(`\nUpdated ${this.changeCount} of ${this.fetchCount} remotes`)
	}
}
