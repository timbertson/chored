import { WalkOptions, bump } from '../lib/bump.ts'

export type Options = WalkOptions & {
	args?: Array<string>
}

export const defaultOptions = {
	exts: ['.ts'],
	args: ['.'],
}

export async function main(opts: Options) {
	let fullOpts = {}
	Object.assign(fullOpts, defaultOptions)
	Object.assign(fullOpts, opts)
	await bump(opts.args || ['.'], opts)
}
