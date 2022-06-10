import { readAll } from 'https://deno.land/std@0.133.0/streams/conversion.ts'
import { DenoFS } from '../fs/impl.ts'

// This file is run from the `chored` bash script, piped in the import map and must produce a trimmed import map
async function main() {
	const input = JSON.parse(new TextDecoder().decode(await readAll(Deno.stdin)))
	const imports: { [k: string]: string } = input.imports
	const filtered: { [k: string]: string } = {}

	for (const [url, path] of Object.entries(imports)) {
		if (await (DenoFS.exists(path))) {
			imports[url] = path
		} else {
			console.warn(`[local] path omitted: ${path}`)
		}
	}
	input.imports = filtered
	console.log(JSON.stringify(input, null, 2))
}

main().catch(e => {
	console.error(e)
	Deno.exit(1)
})
