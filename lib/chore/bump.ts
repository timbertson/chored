import { BumpOptions, bump, defaultOptions as bumpDefaults } from '../deps/bump.ts'
import { parseSpec } from '../deps/source.ts'
import { merge } from '../util/object.ts'
import { partition } from '../util/collection.ts'
import { trimIndent } from "../util/string.ts";
import { run } from "../cmd.ts";

export type Options = BumpOptions & {
	args?: Array<string>
	postChore?: string|null
}

export const defaultOptions: Options = merge<Options>(bumpDefaults, {
	postChore: 'render'
})

export function bumpWith(extraDefaults: Options): (_: Options) => Promise<void> {
	const defaults = merge(defaultOptions, extraDefaults)
	async function chore(opts: Options): Promise<void> {
		const merged = merge(defaults, opts)
		const argsAndSpecs: string[] = merged.args ?? []
		const [specs, roots] = partition(argsAndSpecs, a => a.indexOf('#') !== -1)
		delete merged.args
		merged.explicitSpecs = specs.map(parseSpec)
		await bump(roots, merged)
		
		const chore = merged.postChore
		if (chore != null) {
			console.log(`\nRunning postChore: ${chore} ...`)
			await run(['./chored', chore])
		}
	}
	chore.help = trimIndent(`
		Scan the current directory and bump remote imports when supported.
		
		  - postChore (string|null): run the given chore after bumping, default \`${defaults.postChore ?? 'null'}\`
		  - args (string[]): list of files, directories or specs. Specs take the form "source#version" and can use shorthand.
			    e.g. "chored#testing" will cause chored imports to be bumped to the "testing" branch.
	`)
	return chore
}

export default bumpWith({})
