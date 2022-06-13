import { KV, Options, importMap, importMapObject } from '../deps/import_map.ts'
import { trimIndent } from '../util/string.ts'

export function Make(sources: KV) {
	async function dfl(opts: Options) {
		await importMap(opts, sources)
	}
	dfl.help = trimIndent(`
		dump a localImportMap to stdout, for use with the \`--local\` flag
	`)

	async function print(opts: Options) {
		const obj = await importMapObject(opts, sources)
		console.log(obj)
	}
	
	print.help = trimIndent(`
		print a readable version of the localImportMap, for debugging
	`)
	
	return {
		default: dfl,
		print,
	}
}
