import { assertEquals, assertExists, assertNotEquals } from '../common.ts'
import { notNull } from '../../lib/util/object.ts'
import { FakeFS } from '../../lib/fs/impl.ts'
import { run } from '../../lib/cmd.ts'

import { Bumper, Source, GithubSource, GithubSpec, ImportSpec, GithubImport } from '../../lib/bump.ts'

const url = (r: string, p?: { spec?: string, repo?: string, path?: string }) => {
	const base = `https://raw.githubusercontent.com/${p?.repo ?? 'timbertson/chored'}/${r}/${p?.path ?? 'lib/README.md'}`
	return p?.spec ? base+'#'+p.spec : base
}

function parseGH(s: string): { spec: GithubSpec, import: GithubImport } {
	let p = GithubSource.parse(s)
	if (p == null) {
		throw new Error(`Can't parse GH: ${s}`)
	} else {
		return { spec: p.spec as GithubSpec, import: p.import }
	}
}

Deno.test('bump parseGH', (t) => {
	const base = url('SHA')
	const expected = {
		owner: "timbertson",
		repo: "chored",
		prefix: "https://raw.githubusercontent.com",
		version: "SHA",
		spec: null,
		path: "lib/README.md"
	}
	assertEquals(parseGH(base)?.import, expected)
	assertEquals(parseGH(base + "#ref")?.import, { ... expected, spec: 'ref' })
})

const testSha = '7fa1accd89e45af5c7e60f904d9710c9f4024315'
const testShaTag = 'test-version-0.1.1'

// CI run s a shallow clone; so fetch just these
async function fetchTestCommit() {
	if (Deno.env.get('CI') === 'true') {
		await run(['git', 'fetch', '--depth=1', 'origin', `+refs/tags/${testShaTag}:refs/tags/${testShaTag}`])
	}
}

Deno.test('bump resolve branch', async () => {
	const spec = 'test-branch-1'
	const source = parseGH(url('SHA', { spec }))

	await fetchTestCommit()
	await run(['git', 'branch', '--force', spec, testSha], { printCommand: false })
	
	const update = notNull(await source.spec.resolveFrom('.', false))
	assertEquals(update(source.import), url(testSha, { spec }))
	assertEquals(update({ ... source.import, path: 'Dockerfile' }), url(testSha, { spec, path: 'Dockerfile' }))
})

Deno.test('bump resolve wildcard tag', async () => {
	const spec = 'test-version-*'
	const source = notNull(parseGH(url('SHA', { spec })))

	await fetchTestCommit()
	const update = notNull(await source.spec.resolveFrom('.', false))
	assertEquals(update(source.import), url(testShaTag, { spec }))
})

Deno.test('GithubSource cache identity only cares about repo and spec', () => {
	assertEquals(parseGH(url('COMMIT', { spec: 'branch1' })).spec.identity, 'github:timbertson/chored#branch1')
	assertEquals(parseGH(url('COMMIT')).spec.identity, 'github:timbertson/chored')
	assertEquals(parseGH(url('COMMIT', { repo: 'actions/cache' })).spec.identity, 'github:actions/cache')
})

Deno.test('processImportURLs', async () => {
	const urls: Array<string> = []
	const replaced = await (new Bumper()).processImportURLs(`
		import { foo } from 'https://example.com/mod.ts#main'
		export * as Mod from "http://example.com/mod.ts";
		import {
			foo,
			bar,
			baz
		} from "http://example.com/multiline.ts";

		// this is not an import: https://example.com/unused.ts
	`,
	(url: string) => {
		urls.push(url)
		// delay to ensure we're waiting on all promises
		return new Promise(resolve => setTimeout(resolve, 1)).then(_ => url + '-new')
	})
	
	assertEquals(replaced, `
		import { foo } from 'https://example.com/mod.ts#main-new'
		export * as Mod from "http://example.com/mod.ts-new";
		import {
			foo,
			bar,
			baz
		} from "http://example.com/multiline.ts-new";

		// this is not an import: https://example.com/unused.ts
	`)
})

Deno.test('bumpFile', async () => {
	const fs = new FakeFS()
	const bumper = new Bumper(fs)
	const replacements: { [index: string]: string } = {
		'http://a1': 'http://A1',
		'http://a2': 'http://A2',
	}
	await fs.writeTextFile('a', `
		import * from 'http://a1'
		import * from 'http://a2'
		// code code code
	`)

	const bContents = `
		import * from 'http://b1'
		// code code code
	`
	await fs.writeTextFile('b', bContents)
	const replacer = (url: string) => Promise.resolve(replacements[url] || url)
	assertEquals(await Promise.all([
		bumper.bumpFile('a', replacer),
		bumper.bumpFile('b', replacer),
	]), [ true, false ])
	
	assertEquals(await fs.readTextFile('a'), `
		import * from 'http://A1'
		import * from 'http://A2'
		// code code code
	`)

	assertEquals(await fs.readTextFile('b'), bContents)
})
