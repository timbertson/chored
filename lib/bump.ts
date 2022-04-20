import { notNull } from './util/object.ts'
import { run } from './cmd.ts'
import { FS, DenoFS } from './fs/impl.ts';
import { walk } from './walk.ts'
import { Version } from './version.ts'
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

export interface GithubImport {
	prefix: string,
	path: string,
	version: string,
	spec: string | null,
	owner: string,
	repo: string,
}

// to prove out the tpes work with multiple import types; remove this when we support more thant just GH
interface TestImport {
	foo: boolean
}

type AnyImport = GithubImport | TestImport
type AnySource = Source<GithubImport>|Source<TestImport>

// This would be nicer with a GADT to show a spec could oly be invoked with
// its corresponding import type, but that sounds too hard
type Updater = (imp: AnyImport) => string
function updater<Import extends AnyImport>(fn: (imp: Import) => string): Updater {
	return function(anyImport: AnyImport): string {
		return fn(anyImport as Import)
	}
}

// a specific spec (e.g. github repo & branch)
export interface Spec {
	identity: string,
	resolve(verbose: boolean): Promise<Updater | null>
}

export interface ImportSpec<Import> {
	import: Import,
	spec: Spec,
}

export interface Source<Import> {
	parse(s: string): ImportSpec<Import> | null
}

export class GithubSpec implements Spec {
	identity: string
	repo: string
	ref: string | null

	constructor(imp: {spec: string | null, owner: string, repo: string}) {
		this.ref = imp.spec
		this.identity = GithubSpec.addSpec(imp, `github:${imp.owner}/${imp.repo}`)

		// TODO: use https if there's known creds, otherwise ssh?
		// TODO: reuse deno's credentials system for transparently accessing private repos
		this.repo = `git@github.com:${imp.owner}/${imp.repo}.git`
	}

	private static addSpec(imp: { spec: string | null }, s: string): string {
		if (imp.spec) {
			return s + '#' + imp.spec
		} else {
			return s
		}
	}

	async resolve(verbose: boolean): Promise<Updater|null> {
		return this.resolveFrom(this.repo, verbose)
	}

	async resolveFrom(repo: string, verbose: boolean): Promise<Updater|null> {
		this.repo = repo // only used in testing
		const version = await this.resolveLatestVersion(verbose)
		if (version) {
			return updater<GithubImport>((imp: GithubImport) =>
				GithubSpec.addSpec(imp, `${imp.prefix}/${imp.owner}/${imp.repo}/${version}/${imp.path}`)
			)
		} else {
			return null
		}
	}

	private parseRef(line: string): Ref {
		let [commit, name] = line.split('\t', 2)
		
		// without refs/heads, refs/tags, etc
		const shortName = name.replace(/^refs\/[^/]+\//, '')

		if (name.startsWith('refs/tags/')) {
			// assume immutable; use the friendly name
			commit = shortName
		}
		return { commit, name: shortName }
	}

	private async resolveLatestVersion(verbose: boolean): Promise<string|null> {
		let refs: Array<Ref> = []
		const refFilter = this.ref || 'v*'
		const processLine = (line: string) => refs.push(this.parseRef(line))
		const cmd = ['git', 'ls-remote']
		const isWildcard = refFilter.lastIndexOf('*') >= 0

		if (isWildcard) {
			// grab only version-ish tags
			cmd.push('--tags')
		} else {
			// grab all refs, because we've got a specific ref
			cmd.push('--tags', '--heads')
		}
		cmd.push(this.repo, refFilter)

		await run(cmd, { stdout: processLine, printCommand: verbose })
		if (verbose) {
			console.log(`[refs]: ${refs.length} ${this.repo}`)
		}
		if (refs.length == 0) {
			console.warn(`WARN: No '${refFilter}' refs present in ${this.repo}`)
			return null
		}
		if (!isWildcard) {
			const matchingRefs = refs.filter(r => r.name === this.ref)
			if (matchingRefs.length == 0) {
				console.warn(`WARN: refs received from ${this.repo}, but none matched '${this.ref}'. Returned refs: ${JSON.stringify(refs)}`)
				return null
			} else if (matchingRefs.length > 1) {
				console.warn(`WARN: ${matchingRefs.length} matches for '${this.ref}' in ${this.repo}`)
			}
			return matchingRefs[0].commit
		}

		if (refs.length <= 1) {
			return refs[0]?.commit
		}

		// at least two refs
		const versions = (refs
			.flatMap((ref: Ref) => {
				const v = Version.parse(ref.name)
				return v === null ? [] : [{ v, commit: ref.commit }]
			})
		)
		if (verbose) {
			console.log(`[parsed versions]: ${versions.length} ${this.repo}`)
		}
		if (versions.length == 0) {
			console.warn(`WARN: no versions found in refs: ${JSON.stringify(refs.map(r => r.name))}`)
			return null
		}

		versions.sort((a, b) => Version.compare(a.v, b.v))
		return versions[versions.length-1].commit
	}
}

export const GithubSource = {
	parse(url: string): ImportSpec<GithubImport> | null {
		const gh = url.match(/^(https:\/\/raw\.githubusercontent\.com)\/([^/]+)\/([^/]+)\/([^/]+)\/([^#]+)(#(.+))?$/)
		if (gh !== null) {
			const [_match, prefix, owner, repo, version, path, _hash, spec] = gh
			const imp = {
				owner: notNull(owner),
				repo: notNull(repo),
				prefix: notNull(prefix),
				version: notNull(version),
				spec: spec ? spec : null,
				path: notNull(path),
			}
			return { import: imp, spec: new GithubSpec(imp) }
		}
		
		return null
	}
}

interface Ref {
	name: string,
	commit: string,
}

type AsyncReplacer = (url: string) => Promise<string>

export class Bumper {
	private static dot = new TextEncoder().encode('.')
	verbose: boolean = false

	private fs: FS
	private cache: { [index: string]: Promise<Updater | null> } = {}
	private changedSources: Set<string> = new Set()
	private fetchCount: number = 0
	
	constructor(fsOverride?: FS) {
		this.fs = fsOverride || DenoFS
	}

	private async replaceURL(url: string, sources: Array<AnySource>): Promise<string> {
		for (const source of sources) {
			const importSpec = source.parse(url)
			if (importSpec) {
				const specId = importSpec.spec.identity
				let cached = this.cache[specId]
				if (cached == null) {
					cached = this.cache[specId] = importSpec.spec.resolve(this.verbose)
					this.fetchCount++
					if (this.verbose) {
						console.warn(`[fetch] ${specId}`)
					} else {
						await Deno.stdout.write(Bumper.dot)
					}
				}
				const resolved = await cached
				return resolved ? resolved(importSpec.import) : url
			}
		}
		return url
	}

	summarize() {
		console.log(`\n${this.fetchCount} remote sources found, ${this.changes()} updated`)
	}
	
	changes(): number { return this.changedSources.size }
	
	async bumpFile(path: string, replacer?: AsyncReplacer): Promise<boolean> {
		const defaultReplacer = (url: string) => this.replaceURL(url, defaultSources)
		const contents = await this.fs.readTextFile(path)
		const result = await this.processImportURLs(contents, replacer || defaultReplacer)
		const changed = contents !== result
		if (this.verbose) {
			console.log(`[${changed ? 'updated' : 'unchanged'}]: ${path}`)
		}
		if (changed) {
			await this.fs.writeTextFile(path, result)
		}
		return changed
	}

	async processImportURLs(contents: string, fn: AsyncReplacer): Promise<string> {
		const importRe = /( from +['"])(https?:\/\/[^'"]+)(['"];?\s*)$/gm

		// technique from https://stackoverflow.com/questions/52417975/using-promises-in-string-replace
		const replacements: { [index: string]: string } = {}
		const promises: Array<Promise<void>> = []
		contents.replaceAll(importRe, (_match: string, prefix: string, url: string) => {
			promises.push(fn(url).then(replacement => {
				if (replacement != null) {
					replacements[url] = replacement
				}
			}))
			return ""
		})
		await Promise.all(promises)
		return contents.replaceAll(importRe, (original: string, prefix: string, url: string, suffix: string) => {
			const newUrl = replacements[url]
			if (newUrl == null) {
				return original
			} else {
				return prefix + newUrl + suffix
			}
		})
	}
}

export async function bump(roots: Array<string>, opts: WalkOptions = {}): Promise<number> {
	const work: Array<Promise<boolean>> = []
	const bumper = new Bumper()
	bumper.verbose = opts.verbose ?? false
	for (const root of roots) {
		const rootStat = await Deno.stat(root)
		if (rootStat.isDirectory) {
			for await (const entry of walk(root, { ... opts, followSymlinks: false, includeDirs: false })) {
				if (opts.verbose === true) {
					console.warn(`[bump] ${entry.path}`)
				}
				work.push(bumper.bumpFile(entry.path))
			}
		} else {
			work.push(bumper.bumpFile(root))
		}
	}
	await Promise.all(work)
	bumper.summarize()
	return bumper.changes()
}

export interface WalkOptions {
	exts?: string[]
	match?: RegExp[]
	skip?: RegExp[]
	verbose?: boolean
}

const defaultSources: Array<AnySource> = [
	GithubSource
]
