import { merge } from "./util/object.ts";
import { defaultOptions, defaultSources, Bumper } from './deps/bump.ts'
import { BaseImport, ImportUtil } from './deps/source.ts'
import { computeLock } from "./lock.ts";
import { DenoFS } from "./fs/impl.ts";
import { encode as b64Url } from 'https://deno.land/std@0.143.0/encoding/base64url.ts'
import { trimIndent } from "./util/string.ts";

type KV = { [index: string]: string }

export interface Options {
	verbose?: boolean
}

export async function importMapObject(opts: Options, sources: KV): Promise<KV> {
	const lock = await computeLock()
	const bumpOpts = merge(defaultOptions, opts)
	const bumper = new Bumper({ sources: defaultSources, opts: bumpOpts })
	const imports: KV = {}
	const filteredSources = []

	for (const pair of Object.entries(sources)) {
		const path = pair[1]
		if (await DenoFS.exists(path)) {
			filteredSources.push(pair)
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
		for (const [name, path] of filteredSources) {
			if (importSpec.spec.matchesSpec({ sourceName: name, spec: "unused"})) {
				let localPath = path
				if (!localPath.endsWith('/')) {
					localPath = localPath + '/'
				}
				const root = importSpec.spec.show(ImportUtil.root(importSpec.import) as any)
				imports[root] = `file://${cwd}/${localPath}`
				matched = true
				if (opts.verbose) {
					console.warn(`[match]: ${root} (${url})`)
				}
			}
			if (!matched && opts.verbose) {
				console.warn(`[no-match]: ${url}`)
			}
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

export function logMissingChore(opts: KV) {
	console.warn(trimIndent(`
	ERROR: To use the --local flag, you must implement your own
	       \`localImportMap\` chore. Here's some sample code to
	       place in choredefs/localImportMap.ts:

	import { Options, importMap } from '${import.meta.url}'
	export default async function(opts: Options) {
		await importMap(opts, {
			chored: '../chored',
		})
	}
	`))
	Deno.exit(1)
}
