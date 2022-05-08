import { BumpOptions, bump, defaultOptions as bumpDefaults, parseSpec } from '../bump.ts'
import { merge } from '../util/object.ts'
import { partition } from '../util/collection.ts'
import { Resolver } from '../main/entrypoint.ts'
import { defaultConfig } from '../main/config.ts'

export type Options = BumpOptions & {
	args?: Array<string>
	postChore?: string|null
}

export const defaultOptions: Options = merge<Options>(bumpDefaults, {
	postChore: 'render'
})

export function bumpWith(extraDefaults: Options): (_: Options) => Promise<void> {
	return async function(opts: Options): Promise<void> {
		const merged = merge(defaultOptions, extraDefaults, opts)
		const argsAndSpecs: string[] = merged.args ?? []
		const [specs, roots] = partition(argsAndSpecs, a => a.indexOf('#') !== -1)
		delete merged.args
		merged.explicitSpecs = specs.map(parseSpec)
		await bump(roots, merged)
		
		const chore = merged.postChore
		if (chore != null) {
			console.log(`\nRunning postChore: ${chore} ...`)
			await new Resolver(defaultConfig).run([chore], {})
		}
	}
}

export default bumpWith({})
