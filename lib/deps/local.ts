import { merge } from "../util/object.ts";
import { defaultOptions, defaultSources, Bumper, walkRoots } from './bump.ts'
import { JSONFile } from "../render/file.ts";

export interface Import {
	dependency: string,
	localPath: string,
}

type KV = { [index: string]: string }

class Accumulator {
	opts: Options
	bumper: Bumper
	imports: KV = {}

	constructor(opts: Options, bumper: Bumper) {
		this.opts = opts
		this.bumper = bumper
	}

	replace(url: string) : Promise<string> {
		const importSpec = this.bumper.parse(url)
		if (importSpec) {
			let matched = false
			for (let [name, path] of Object.entries(this.opts.sources)) {
				if (importSpec.spec.matchesSpec({ sourceName: name, spec: "unused"})) {
					let localPath = path
					if (!localPath.endsWith('/')) {
						localPath = localPath + '/'
					}
					const root = importSpec.spec.root(importSpec.import as any)
					this.imports[root] = localPath
					matched = true
					if (this.opts.verbose) {
						console.log(`[match]: ${root} (${url})`)
					}
				}
			}

			if (!matched && this.opts.verbose) {
				console.log(`[no-match]: ${url}`)
			}
		}
		// don't actually replace anything, we're (ab)using the bumper's
		// import replacement algorithm
		return Promise.resolve(url)
	}
}

export interface Options {
	verbose?: boolean
	scanRoots?: string[]
	exts?: string[]
	sources: KV
}

export async function file(opts: Options): Promise<JSONFile> {
	const bumpOpts = merge(defaultOptions, opts)
	const bumper = new Bumper({ sources: defaultSources, opts: bumpOpts })
	const accumulator = new Accumulator(opts, bumper)

	async function handle(path: string): Promise<void> {
		await bumper.bumpSourceFile(path, (url) => accumulator.replace(url))
	}

	await walkRoots(opts.scanRoots ?? [], bumpOpts, handle)
	const f = new JSONFile('choredefs/local-deps.json', { imports: accumulator.imports })
	// import maps have strict key checking, so we can't include a marker
	f.includeMarker = false
	return f
}
