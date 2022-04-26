import { WalkOptions, bump, defaultOptions as bumpDefaults } from '../bump.ts'
import { merge } from '../util/object.ts'

export type Options = WalkOptions & {
	args?: Array<string>
}

export const defaultOptions: Options = bumpDefaults

export function bumpWith(extraDefaults: Options): (_: Options) => Promise<void> {
	return async function(opts: Options): Promise<void> {
		const merged = merge(defaultOptions, extraDefaults, opts)
		const roots = merged.args || ['.']
		await bump(roots, merged)
	}
}

export default bumpWith({})
