import { WalkOptions, bump } from '../bump.ts'
import { merge } from '../util/object.ts'

export type Options = WalkOptions & {
	args?: Array<string>
}

export const defaultOptions: Options = {
	exts: ['.ts'],
	skip: [/^\..+/],
	args: ['.'],
}

export function bumpWith(extraDefaults: Options): (_: Options) => Promise<void> {
	return async function(opts: Options): Promise<void> {
		console.log(1)
		const merged = merge(defaultOptions, extraDefaults, opts)
		const roots = merged.args || ['.']
		console.log(merged)
		await bump(roots, merged)
	}
}

export default bumpWith({})
