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

// to prove out the tpes work with multiple import types; remove this when we support more thant just GH
interface TestImport {
	foo: boolean
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
	repo: string
	ref: string | null

	constructor(imp: {spec: string | null, owner: string, repo: string}) {
		this.ref = imp.spec
		this.origin = `github:${imp.owner}/${imp.repo}`
		this.identity = GithubSpec.addSpec(imp, this.origin)

		// TODO: use https if there's known creds, otherwise ssh?
		// TODO: reuse deno's credentials system for transparently accessing private repos
		this.repo = `git@github.com:${imp.owner}/${imp.repo}.git`
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

	async resolve(verbose: boolean): Promise<Updater|null> {
		return this.resolveFrom(this.repo, verbose)
	}

	async resolveFrom(repo: string, verbose: boolean): Promise<Updater|null> {
		this.repo = repo // only used in testing
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
		cmd.push(this.repo, refFilter)

		await run(cmd, { stdout: processLine, printCommand: verbose })
		if (verbose) {
			console.log(`[refs]: ${refs.length} ${this.repo}`)
			for (const ref of refs) {
				console.log(`[ref]: ${ref.name} ${ref.commit}`)
			}
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

export class Bumper {
	private static dot = new TextEncoder().encode('.')
	verbose: boolean = false

	private fs: FS
	private sources: AnySource[]
	cache: { [index: string]: Promise<Updater | null> } = {}
	private changedSources: Set<string> = new Set()
	private fetchCount: number = 0
	
	constructor(opts?: { sources?: Array<AnySource>, fs?: FS }) {
		this.sources = opts?.sources ?? defaultSources
		this.fs = opts?.fs ?? DenoFS
	}

	private parse(url: string): AnyImportSpec | null {
		for (const source of this.sources) {
			const importSpec = source.parse(url)
			if (importSpec) {
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
			return resolved ? resolved.apply(importSpec.import) : url
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
			console.log(`[${changed ? 'updated' : 'unchanged'}]: ${path}`)
		}
		if (changed) {
			await this.fs.writeTextFile(path, result)
		}
		return changed
	}
	
	async bumpImportMap(path: string): Promise<void> {
		const json = JSON.parse(await this.fs.readTextFile(path))
		let changed = false
		if (json && Object.hasOwn(json, 'sources')) {
			const sources = json.sources
			const entries: [string, any][] = Array.from(Object.entries(sources))
			entries.sort((a, b) => a[0].localeCompare(b[0]))
			for (const [k,v] of entries) {
				const newKeys = sort(await this.explodeCachedURLs(k))
				if (newKeys.length > 0) {
					changed = true
					delete sources[k]
					for (const newKey of newKeys) {
						sources[newKey] = v
					}
				}
			}
		}
		if (changed) {
			await this.fs.writeTextFile(path, JSON.stringify(json.sources, null, 2))
		}
	}

	private async explodeCachedURLs(url: string): Promise<string[]> {
		const rv = []
		const importSpec = this.parse(url)
		if (!importSpec) {
			if (this.verbose) {
				console.log("Invalid URL: ", url)
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
}

export async function bump(roots: Array<string>, overrides: WalkOptions = {}): Promise<number> {
	const opts = merge(defaultOptions, overrides)
	const work: Array<Promise<boolean>> = []
	const bumper = new Bumper()
	bumper.verbose = opts.verbose ?? false

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

	const walkOpts = { ... opts, exts, followSymlinks: false, includeDirs: false }
	for (const root of roots) {
		if (opts.verbose === true) console.log(`[walk] root: ${root}`)
		const rootStat = await Deno.stat(root)
		if (rootStat.isDirectory) {
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

export interface WalkOptions {
	exts?: string[]
	importMapExt?: string | null
	match?: RegExp[]
	skip?: RegExp[]
	verbose?: boolean
}

export const defaultOptions : WalkOptions = {
	exts: ['.ts'],
	importMapExt: 'map.json',
	skip: [/^\./],
}

const defaultSources: Array<AnySource> = [
	GithubSource
]
