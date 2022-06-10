import { Options, importMap } from '../lib/localImportMap.ts'

export default async function(opts: {}) {
	await generate(opts, {
		chored: '../chored',
	})
}
