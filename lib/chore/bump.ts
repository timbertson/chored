import { WalkOptions, bump } from '../bump.ts'
import merge from '../util/shallow_merge.ts'

export type Options = WalkOptions & {
	args?: Array<string>
}

export const defaultOptions = {
	exts: ['.ts'],
	skip: [/^\..+/],
	args: ['.'],
}

export function bumpWith(extraDefaults: Options): (_: Options) => Promise<void> {
	return async function(opts: Options): Promise<void> {
		const merged = merge(defaultOptions, extraDefaults, opts)
		await bump(merged.args || ['.'], merged)
	}
}

export const main: (opts: Options) => Promise<void> = bumpWith({})
