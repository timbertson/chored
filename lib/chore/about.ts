import { replaceSuffix, trimIndent } from '../util/string.ts'
import { notNull } from '../util/object.ts'
import { listVersions } from '../deps/deno.ts'
import { GithubSpec, GithubImport } from '../deps/github.ts'

const root = replaceSuffix(import.meta.url, 'lib/chore/about.ts', '')

export default async function(opts: {}) {
	console.log(`\n\nchored running from: ${root}`)
	const versions = await listVersions('chored')
	console.log(`\nThe latest release is:\n  https://deno.land/x/chored@${versions.latest}/lib/`)
	const imp: GithubImport = {
		prefix: 'https://raw.githubusercontent.com',
		version: 'main',
		owner: 'timbertson',
		repo: 'chored',
		path: 'README.md',
		spec: 'main',
	}
	const gh = new GithubSpec(imp)
	const latest: string = notNull(await gh.resolve(false))
	console.log(`\nThe latest development commit is:\n  ${gh.show({...imp, version: latest })}`)
}
