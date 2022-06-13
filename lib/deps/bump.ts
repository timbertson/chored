import { merge } from '../util/object.ts'
import { FS, DenoFS } from '../fs/impl.ts';
import { walk } from '../walk.ts'
import { AnyImportSpec, AnySource, BaseImport, BumpSpec, makeOverrideFn } from './source.ts'
import { GithubSource } from './github.ts'
import { DenoSource } from './deno.ts'

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
	cache: { [index: string]: Promise<string | null> } = {}
	private changedSources: Set<string> = new Set()
	private fetchCount = 0
	
	constructor(opts: { sources: Array<AnySource>, opts: BumperOptions, fs?: FS }) {
		this.sources = opts.sources
		this.opts = opts.opts
		this.verbose = this.opts.verbose ?? false
		this.fs = opts?.fs ?? DenoFS
	}

	parse(url: string): AnyImportSpec | null {
		const overrideFn = makeOverrideFn<any>(this.opts.explicitSpecs ?? [])
		for (const source of this.sources) {
			const importSpec = source.parse(url, overrideFn)
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
				cached = this.cache[specId] = (async () => {
					const version = await importSpec.spec.resolve(this.verbose)
					if (version != null && this.opts.verbose) {
						console.log(`[version] ${version} ${specId}`)
					}
					return version
				})()
				this.fetchCount++
				if (this.verbose) {
					console.warn(`[fetch] ${specId}`)
				} else {
					await Deno.stdout.write(Bumper.dot)
				}
			}
			const resolved = await cached
			if (resolved) {
				const imp: BaseImport = { ...importSpec.import, version: resolved }
				const replacement = importSpec.spec.show(imp as any)
				if (replacement !== url) {
					this.changedSources.add(specId)
					return replacement
				}
			}
		}
		return url
	}

	async summarize() {
		const missing: string[] = []
		for (const [k,v] of Object.entries(this.cache)) {
			if (await v == null) {
				missing.push(k)
			}
		}
		if (missing.length > 1) {
			console.log('')
			console.log(`${missing.length} sources have no available versions:`)
			for (const m of missing) {
				console.log(` - ${m}`)
			}
		}
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
	
	async processImports(contents: string, fn: AsyncReplacer): Promise<string> {
		const importRe = /( from +['"])(https?:\/\/[^'"]+)(['"];?\s*)$/gm

		// technique from https://stackoverflow.com/questions/52417975/using-promises-in-string-replace
		const replacements: { [index: string]: string } = {}
		const promises: Array<Promise<void>> = []
		contents.replaceAll(importRe, (_match: string, _prefix: string, url: string) => {
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

	static async _bump(roots: Array<string>, opts: BumpOptions = {}, sources?: AnySource[]): Promise<number> {
		opts = merge(defaultOptions, opts)
		const bumper = new Bumper({ sources: sources ?? defaultSources, opts })
		async function handle(path: string) {
			if (opts.verbose === true) {
				console.warn(`[bump] ${path}`)
			}
			await bumper.bumpSourceFile(path)
		}

		await walkRoots(roots, opts, handle)
		await bumper.summarize()
		return bumper.changes()
	}
}

export async function walkRoots(roots: Array<string>, opts: BumpOptions, handle: (path: string) => Promise<void>) {
	const work: Array<Promise<void>> = []

	if (roots.length == 0) {
		roots = ['.']
	}

	const exts = opts.exts ?? []
	if (exts.length === 0) {
		throw new Error("Empty array of `exts` passed to walk function")
	}
	const walkOpts = { ... opts, exts, followSymlinks: false, includeDirs: false }
	if (opts.verbose === true) console.log(`[opts] ${JSON.stringify(walkOpts)} ${JSON.stringify(roots)}`)
	for (const root of roots) {
		const rootStat = await Deno.stat(root)
		if (rootStat.isDirectory) {
			if (opts.verbose === true) console.log(`[walk] root: ${root}`)
			for await (const entry of walk(root, walkOpts)) {
				work.push(handle(entry.path))
			}
		} else {
			work.push(handle(root))
		}
	}

	await Promise.all(work)
}

export async function bump(roots: Array<string>, overrides: BumpOptions = {}): Promise<void> {
	await Bumper._bump(roots, overrides)
}

export interface BumpOptions extends BumperOptions {
	exts?: string[]
	match?: RegExp[]
	skip?: RegExp[]
}

export const defaultOptions : BumpOptions = {
	exts: ['.ts'],
	skip: [/^\..+/, /node_modules$/],
}

export const defaultSources: Array<AnySource> = [
	GithubSource, DenoSource
]
