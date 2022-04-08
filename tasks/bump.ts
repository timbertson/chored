import { WalkOptions, bump } from '../lib/bump.ts'

export type Options = WalkOptions & {
	args?: Array<string>
}

export const defaultOptions = {
	exts: ['.ts'],
	skip: [/^\..+/],
	args: ['.'],
}

export async function main(opts: Options) {
	await bump(opts.args || ['.'], { ...defaultOptions, ...opts })
}
