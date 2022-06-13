import { BumpOptions, bump as bumpImpl, defaultOptions as bumpDefaults } from '../deps/bump.ts'
import { parseSpec } from '../deps/source.ts'
import { merge } from '../util/object.ts'
import { defaulted } from '../util/function.ts'
import { partition } from '../util/collection.ts'
import { Resolver } from '../main/entrypoint.ts'
import { defaultConfig } from '../main/config.ts'
import { trimIndent } from "../util/string.ts";
import * as ImportMap from '../deps/import_map.ts'

export type Options = BumpOptions & {
	args?: Array<string>
	postChore?: string|null
}

export const defaultOptions: Options = merge<Options>(bumpDefaults, {
	postChore: 'render'
})

export function Make(extraDefaults: Options) {
	const defaults = merge(defaultOptions, extraDefaults)
	function extractOptions(opts: Options) {
		const merged = merge(defaults, opts)
		const argsAndSpecs: string[] = merged.args ?? []
		const [specs, roots] = partition(argsAndSpecs, a => a.indexOf('#') !== -1)
		delete merged.args
		merged.explicitSpecs = specs.map(parseSpec)
		return { roots, merged }
	}

	return {
		bump: defaulted(defaults, async (opts: Options): Promise<void> => {
			const { roots, merged } = extractOptions(opts)
			await bumpImpl(roots, merged)
			
			const chore = merged.postChore
			if (chore != null) {
				console.log(`\nRunning postChore: ${chore} ...`)
				await new Resolver(defaultConfig).run([chore], {})
			}
		}, {
			help: trimIndent(`
				Scan the current directory and bump remote imports when supported.
				
					- postChore (string|null): run the given chore after bumping, default \`${defaults.postChore ?? 'null'}\`
					- args (string[]): list of files, directories or specs. Specs take the form "source#version" and can use shorthand.
							e.g. "chored#testing" will cause chored imports to be bumped to the "testing" branch.
			`)
		})
	}
}

const base = Make({})
export const bump = base.bump
