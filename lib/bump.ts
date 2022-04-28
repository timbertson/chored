import { merge, notNull } from './util/object.ts'
import { sort } from './util/collection.ts'
import { run } from './cmd.ts'
import { FS, DenoFS } from './fs/impl.ts';
import { walk } from './walk.ts'
import { Version } from './version.ts'
/*
 * Based on https://deno.land/x/dmm
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

// used in tests
export interface TestImport {
	url: string
}

type AnyImport = GithubImport | TestImport
type AnyImportSpec = ImportSpec<GithubImport> | ImportSpec<TestImport>
type AnySource = Source<GithubImport>|Source<TestImport>

// This would be nicer with a GADT to show a spec could oly be invoked with
// its corresponding import type, but that sounds too hard
interface Updater {
	origin: string,
	apply: (imp: AnyImport) => string,
}
export function _updater<Import extends AnyImport>(origin: string, fn: (imp: Import) => string): Updater {
	return {
		origin,
		apply: function(anyImport: AnyImport): string {
			return fn(anyImport as Import)
		}
	}
}

// a specific spec (e.g. github repo & branch)
export interface Spec {
	origin: string,
	identity: string,
	adaptIfMatch(spec: BumpSpec): void
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
	origin: string
	repoName: string
	repoPath: string
	repoURL: string
	ref: string | null

	constructor(imp: {spec: string | null, owner: string, repo: string}) {
		this.ref = imp.spec
		this.repoName = imp.repo
		this.repoPath = `${imp.owner}/${imp.repo}`
		this.origin = `github:${this.repoPath}`
		this.identity = GithubSpec.addSpec(imp, this.origin)

		// TODO: use https if there's known creds, otherwise ssh?
		// TODO: reuse deno's credentials system for transparently accessing private repos
		this.repoURL = `git@github.com:${imp.owner}/${imp.repo}.git`
	}

	static show(imp: GithubImport): string {
		return GithubSpec.addSpec(imp, `${imp.prefix}/${imp.owner}/${imp.repo}/${imp.version}/${imp.path}`)
	}

	private static addSpec(imp: { spec: string | null }, s: string): string {
		if (imp.spec) {
			return s + '#' + imp.spec
		} else {
			return s
		}
	}

	adaptIfMatch(spec: BumpSpec): void {
		if (spec.sourceName === this.repoName || spec.sourceName === this.repoPath) {
			this.ref = spec.spec
		}
	}

	async resolve(verbose: boolean): Promise<Updater|null> {
		return this.resolveFrom(this.repoURL, verbose)
	}

	async resolveFrom(repoURL: string, verbose: boolean): Promise<Updater|null> {
		this.repoURL = repoURL // only used in testing
		const version = await this.resolveLatestVersion(verbose)
		if (version) {
			if (verbose) {
				console.log(`[version] ${version} ${this.identity}`)
			}
			return _updater<GithubImport>(this.origin,
				(imp: GithubImport) => GithubSpec.show({ ...imp, version })
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
		cmd.push(this.repoURL, refFilter)

		await run(cmd, { stdout: processLine, printCommand: verbose })
		if (verbose) {
			console.log(`[refs]: ${refs.length} ${this.repoURL}`)
			for (const ref of refs) {
				console.log(`[ref]: ${ref.name} ${ref.commit}`)
			}
		}
		if (refs.length == 0) {
			console.warn(`WARN: No '${refFilter}' refs present in ${this.repoURL}`)
			return null
		}
		if (!isWildcard) {
			const matchingRefs = refs.filter(r => r.name === this.ref)
			if (matchingRefs.length == 0) {
				console.warn(`WARN: refs received from ${this.repoPath}, but none matched '${this.ref}'. Returned refs: ${JSON.stringify(refs)}`)
				return null
			} else if (matchingRefs.length > 1) {
				console.warn(`WARN: ${matchingRefs.length} matches for '${this.ref}' in ${this.repoPath}`)
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
			console.log(`[parsed versions]: ${versions.length} ${this.repoPath}`)
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
		const gh = url.match(/^(https:\/\/raw\.githubusercontent\.com)\/([^/]+)\/([^/]+)\/([^/]+)\/([^#]*)(#(.+))?$/)
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

interface BumperOptions {
	verbose?: boolean
	explicitSpecs?: BumpSpec[]
}

export class Bumper {
	private static dot = new TextEncoder().encode('.')
	private verbose: boolean
	private opts: BumperOptions

	private fs: FS
	private sources: AnySource[]
	cache: { [index: string]: Promise<Updater | null> } = {}
	private changedSources: Set<string> = new Set()
	private fetchCount: number = 0
	
	constructor(opts: { sources: Array<AnySource>, opts: BumperOptions, fs?: FS }) {
		this.sources = opts.sources
		this.opts = opts.opts
		this.verbose = this.opts.verbose ?? false
		this.fs = opts?.fs ?? DenoFS
	}

	parse(url: string): AnyImportSpec | null {
		for (const source of this.sources) {
			const importSpec = source.parse(url)
			if (importSpec) {
				for (const override of (this.opts.explicitSpecs ?? [])) {
					importSpec.spec.adaptIfMatch(override)
				}
				return importSpec
			}
		}
		return null
	}

	private async replaceURL(url: string): Promise<string> {
		const importSpec = this.parse(url)
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
			if (resolved) {
				const replacement = resolved.apply(importSpec.import)
				if (replacement !== url) {
					this.changedSources.add(specId)
					return replacement
				}
			}
		}
		return url
	}

	summarize() {
		console.log(`\n${this.fetchCount} remote sources found, ${this.changes()} updated`)
	}
	
	changes(): number { return this.changedSources.size }
	
	async bumpSourceFile(path: string, replacer?: AsyncReplacer): Promise<boolean> {
		const defaultReplacer = (url: string) => this.replaceURL(url)
		const contents = await this.fs.readTextFile(path)
		const result = await this.processImports(contents, replacer || defaultReplacer)
		const changed = contents !== result
		if (this.verbose) {
			console.log(`[${changed ? 'modified' : 'unchanged'}]: ${path}`)
		}
		if (changed) {
			await this.fs.writeTextFile(path, result)
		}
		return changed
	}
	
	async bumpImportMap(path: string): Promise<void> {
		const json = JSON.parse(await this.fs.readTextFile(path))
		let changed = false
		if (json && Object.hasOwn(json, 'imports')) {
			const imports = json.imports
			const entries: [string, any][] = Array.from(Object.entries(imports))
			entries.sort((a, b) => a[0].localeCompare(b[0]))
			for (const [k,v] of entries) {
				const newKeys = sort(await this.explodeCachedURLs(k))
				if (newKeys.length > 0) {
					changed = true
					delete imports[k]
					for (const newKey of newKeys) {
						imports[newKey] = v
					}
				}
			}
		}
		if (changed) {
			await this.fs.writeTextFile(path, JSON.stringify(json, null, 2))
		}
	}

	private async explodeCachedURLs(url: string): Promise<string[]> {
		const rv = []
		const importSpec = this.parse(url)
		if (!importSpec) {
			if (this.verbose) {
				console.log("Unknown URL: ", url)
			}
			return []
		}

		const origin = importSpec.spec.origin
		for (const updaterPromise of Object.values(this.cache)) {
			const updater = await updaterPromise
			if (updater && updater.origin === origin) {
				const replaced = updater.apply(importSpec.import)
				if (replaced !== url) {
					rv.push(replaced)
				}
			}
		}
		if (this.verbose) {
			console.log(`[import] ${JSON.stringify(url)} => ${JSON.stringify(rv)}`)
		}
		return rv
	}

	async processImports(contents: string, fn: AsyncReplacer): Promise<string> {
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

	static async _bump(roots: Array<string>, overrides: BumpOptions = {}, sources?: AnySource[]): Promise<number> {
		const opts = merge(defaultOptions, overrides)
		const work: Array<Promise<boolean>> = []
		const bumper = new Bumper({ sources: sources ?? defaultSources, opts })

		let exts = opts.exts ?? []
		const importMapExt = opts.importMapExt
		let isImportMap = (_: string) => false
		if (importMapExt != null) {
			isImportMap = (path: string) => path.endsWith(importMapExt)
			exts = [ ...exts, importMapExt ]
		}
		const importMaps: string[] = []
		function handle(path: string) {
			if (opts.verbose === true) {
				console.warn(`[bump] ${path}`)
			}
			if (isImportMap(path)) {
				importMaps.push(path)
			} else {
				work.push(bumper.bumpSourceFile(path))
			}
		}

		if (roots.length == 0) {
			roots = ['.']
		}
		const walkOpts = { ... opts, exts, followSymlinks: false, includeDirs: false }
		if (opts.verbose === true) console.log(`[opts] ${JSON.stringify(walkOpts)} ${JSON.stringify(roots)}`)
		for (const root of roots) {
			const rootStat = await Deno.stat(root)
			if (rootStat.isDirectory) {
				if (opts.verbose === true) console.log(`[walk] root: ${root}`)
				for await (const entry of walk(root, walkOpts)) {
					handle(entry.path)
				}
			} else {
				handle(root)
			}
		}
		await Promise.all(work)

		// now that all sources are bumped, process import maps
		for (const importMap of importMaps) {
			await bumper.bumpImportMap(importMap)
		}

		bumper.summarize()
		return bumper.changes()
	}
}

export async function bump(roots: Array<string>, overrides: BumpOptions = {}): Promise<void> {
	await Bumper._bump(roots, overrides)
}

// used to explicitly specify a target for a given remote
export interface BumpSpec {
	sourceName: string,
	spec: string,
}

export function parseSpec(s: string): BumpSpec {
	const parts = s.split('#')
	if (parts.length === 2) {
		const [sourceName, spec] = parts
		return { sourceName, spec }
	}
	throw new Error(`Can't parse spec: ${s}`)
}

export interface BumpOptions extends BumperOptions {
	exts?: string[]
	importMapExt?: string | null
	match?: RegExp[]
	skip?: RegExp[]
}

export const defaultOptions : BumpOptions = {
	exts: ['.ts'],
	importMapExt: 'map.json',
	skip: [/^\..+/],
}

const defaultSources: Array<AnySource> = [
	GithubSource
]
