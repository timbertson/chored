// This is a special module which will be searched as a fallback for chores.
// Not all chores distributed with chored will be exported here, it's just
// for the common ones

import { replaceSuffix, trimIndent } from '../util/string.ts'
export * as deps from './deps.ts'
export { default as render } from './render.ts'
export { default as about } from './about.ts'

export function localImportMap(opts: {}) {
	const url = replaceSuffix(import.meta.url, 'builtins.ts', 'localImportMap.ts')
	console.warn(trimIndent(`
	ERROR: To use the --local flag, you must implement your own
	       \`localImportMap\` chore containing local paths for
	       typescript dependencies. Here's an example to
	       place in choredefs/localImportMap.ts:

	import { Make } from '${url}'
	export default Make({
	  chored: '../chored',
	})
	`))
	Deno.exit(1)
}
