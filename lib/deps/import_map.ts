import { merge } from "../util/object.ts";
import { defaultOptions, defaultSources, Bumper } from './bump.ts'
import { ImportUtil, BumpSpec } from './source.ts'
import { computeLock } from "./lock.ts";
import { DenoFS } from "../fs/impl.ts";
import { encode as b64Url } from 'https://deno.land/std@0.143.0/encoding/base64url.ts'

export type KV = { [index: string]: string }

export interface Options {
	verbose?: boolean
}

interface FilteredSource {
	spec: BumpSpec
	path: string
	used: boolean
}

export async function importMapObject(opts: Options, sources: KV): Promise<KV> {
	const lock = await computeLock()
	const bumpOpts = merge(defaultOptions, opts)
	const bumper = new Bumper({ sources: defaultSources, opts: bumpOpts })
	const imports: KV = {}
	const filteredSources: FilteredSource[] = []

	for (const [name, path] of Object.entries(sources)) {
		if (await DenoFS.exists(path)) {
			filteredSources.push({
				spec: { sourceName: name, spec: 'unused' },
				path,
				used: false
			})
		} else {
			console.warn(`[missing]: ${path}`)
		}
	}
	if (opts.verbose) {
		console.warn(`after filtering, there are ${filteredSources.length} sources`)
	}

	for (const url of Object.keys(lock)) {
		const importSpec = bumper.parse(url)
		if (importSpec == null) {
			continue
		}

		let matched = false
		const cwd = Deno.cwd()
		for (const source of filteredSources) {
			if (importSpec.spec.matchesSpec(source.spec)) {
				let localPath = source.path
				if (!localPath.endsWith('/')) {
					localPath = localPath + '/'
				}
				const root = importSpec.spec.show(ImportUtil.root(importSpec.import) as any)
				imports[root] = `file://${cwd}/${localPath}`
				matched = true
				source.used = true
				if (opts.verbose) {
					console.warn(`[match]: ${root} (${url})`)
				}
			}
			if (!matched && opts.verbose) {
				console.warn(`[no-match]: ${url}`)
			}
		}
	}

	for (const source of filteredSources) {
		if (!source.used) {
			console.warn(`[unused]: ${source.spec.sourceName}`)
		}
	}
	if (opts.verbose) {
		console.warn(`import map map contains ${Object.keys(imports).length} entry`)
	}
	return imports
}

export async function importMap(opts: Options, sources: KV) {
	const imports = await importMapObject(opts, sources)
	const result = { imports }
	if(opts.verbose === true) {
		console.warn(JSON.stringify(result, null, 2))
	}
	console.log('data:text/plain;base64,' + b64Url(JSON.stringify(result)))
}
