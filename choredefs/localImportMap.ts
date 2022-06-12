import { Options, importMap } from '../lib/localImportMap.ts'

export default async function(opts: Options) {
	await importMap(opts, {
		chored: '../chored',
	})
}
