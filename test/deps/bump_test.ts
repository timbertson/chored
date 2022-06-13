import { assertEquals } from '../common.ts'
import { notNull } from '../../lib/util/object.ts'
import { DenoFS, FakeFS } from '../../lib/fs/impl.ts'
import { run } from '../../lib/cmd.ts'

import { Bumper } from '../../lib/deps/bump.ts'
import { BaseImport, BumpSpec, ImportUtil, makeOverrideFn, OverrideFn, Source, TestImport } from '../../lib/deps/source.ts'
import { GithubSource, GithubSpec, GithubImport } from '../../lib/deps/github.ts'
import { DenoSource, DenoSpec, DenoImport } from '../../lib/deps/deno.ts'
import withTempDir from "../../lib/fs/with_temp_dir.ts";

const url = (r: string, p?: { spec?: string, repo?: string, path?: string }) => {
	const base = `https://raw.githubusercontent.com/${p?.repo ?? 'timbertson/chored'}/${r}/${p?.path ?? 'lib/README.md'}`
	return ImportUtil.addSpec({ spec: p?.spec ?? null }, base)
}

function parseGH(s: string, overrides: BumpSpec[] = []): { spec: GithubSpec, import: GithubImport } {
	let p = GithubSource.parse(s, makeOverrideFn<GithubImport>(overrides))
	if (p == null) {
		throw new Error(`Can't parse GH: ${s}`)
	} else {
		return { spec: p.spec as GithubSpec, import: p.import }
	}
}

const denoUrl = (v: string | null, p?: { spec?: string, name?: string, path?: string }) => {
	const base = `https://deno.land/x/${p?.name ?? 'chored'}${v == null ? '' : '@'+v}/${p?.path ?? 'lib/README.md'}`
	return ImportUtil.addSpec({ spec: p?.spec ?? null }, base)
}

function parseDeno(s: string, overrides: BumpSpec[] = []): { spec: DenoSpec, import: DenoImport } {
	const p = DenoSource.parse(s, makeOverrideFn<DenoImport>(overrides))
	if (p == null) {
		throw new Error(`Can't parse Deno: ${s}`)
	} else {
		return { spec: p.spec as DenoSpec, import: p.import }
	}
}

Deno.test('GithubSource', async (t) => {
	const base = url('SHA')
	const expected = {
		owner: "timbertson",
		repo: "chored",
		prefix: "https://raw.githubusercontent.com",
		version: "SHA",
		spec: null,
		path: "lib/README.md"
	}

	await t.step('parsing', () => {
		assertEquals(parseGH(base)?.import, expected)
		assertEquals(parseGH(base + "#ref")?.import, { ... expected, spec: 'ref' })
		assertEquals(parseGH(url('SHA', { path: '' }))?.import, { ... expected, path: '' })
	})

	await t.step('root ', () => {
		const parsed = notNull(parseGH(url('SHA', { spec: 'spec' })))
		assertEquals(parsed.spec.show(ImportUtil.root(parsed.import)), 'https://raw.githubusercontent.com/timbertson/chored/SHA/')
	})

	await t.step('overrides', () => {
		function overrideSpec(o: BumpSpec) {
			return notNull(parseGH(base, [o])).spec.spec
		}
		assertEquals(overrideSpec({ sourceName: 'other', spec: 'foo' }), null)
		assertEquals(overrideSpec({ sourceName: 'chored', spec: 'foo' }), 'foo')
		assertEquals(overrideSpec({ sourceName: 'timbertson/chored', spec: 'foo' }), 'foo')
	})
})

Deno.test('DenoSource', async (t) => {
	const base = denoUrl('1.0')
	const expected: DenoImport = {
		name: "chored",
		prefix: "https://deno.land/x",
		version: "1.0",
		spec: null,
		path: "lib/README.md"
	}

	await t.step('parsing', () => {
		assertEquals(parseDeno(base)?.import, expected)
		assertEquals(parseDeno(base.replace('/x/chored', '/std'))?.import, { ... expected, name: 'std', prefix: 'https://deno.land' })
		assertEquals(parseDeno(denoUrl(null))?.import, { ... expected, version: null })
		assertEquals(parseDeno(base + "#ref")?.import, { ... expected, spec: 'ref' })
		assertEquals(parseDeno(denoUrl('1.0', { path: '' }))?.import, { ... expected, path: '' })
	})

	await t.step('root', () => {
		const parsed = notNull(parseDeno(denoUrl('1.0', { spec: 'spec' })))
		assertEquals(parsed.spec.show(ImportUtil.root(parsed.import)), 'https://deno.land/x/chored@1.0/')
	})

	await t.step('overrides', () => {
		function overrideSpec(o: BumpSpec) {
			return notNull(parseDeno(base, [o])).spec.spec
		}
		assertEquals(overrideSpec({ sourceName: 'other', spec: 'foo' }), null)
		assertEquals(overrideSpec({ sourceName: 'chored', spec: 'foo' }), 'foo')
	})
})

const testSha = '7fa1accd89e45af5c7e60f904d9710c9f4024315'
const testShaTag = 'test-version-0.1.1'

// CI runs a shallow clone; so fetch just these
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
	
	assertEquals(await source.spec.resolveFrom('.', false), testSha)
})

Deno.test('bump resolve wildcard tag', async () => {
	const spec = 'test-version-*'
	const source = notNull(parseGH(url('SHA', { spec })))

	await fetchTestCommit()
	assertEquals(await source.spec.resolveFrom('.', false), testShaTag)
})

Deno.test('GithubSource cache identity only cares about repo and spec', () => {
	assertEquals(parseGH(url('COMMIT', { spec: 'branch1' })).spec.identity, 'github:timbertson/chored#branch1')
	assertEquals(parseGH(url('COMMIT')).spec.identity, 'github:timbertson/chored')
	assertEquals(parseGH(url('COMMIT', { repo: 'actions/cache' })).spec.identity, 'github:actions/cache')
})

Deno.test('processImportURLs', async () => {
	const urls: Array<string> = []
	const replaced = await (new Bumper({ sources: [], opts: {}})).processImports(`
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
	const bumper = new Bumper({ sources: [], opts: {}, fs })
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
		bumper.bumpSourceFile('a', replacer),
		bumper.bumpSourceFile('b', replacer),
	]), [ true, false ])
	
	assertEquals(await fs.readTextFile('a'), `
		import * from 'http://A1'
		import * from 'http://A2'
		// code code code
	`)

	assertEquals(await fs.readTextFile('b'), bContents)
})

Deno.test('bump walk', () => withTempDir({}, async (dir) => {
	await DenoFS.mkdirp(`${dir}/a/b/c`)
	await DenoFS.writeTextFile(`${dir}/main.ts`, `
		export * from 'https://example.com/v1/main.ts'
	`.trim())
	await DenoFS.writeTextFile(`${dir}/a/b/c/nested.ts`, `
		export * from 'https://example.com/v1/lib/nested.ts'
 `.trim())
 	
 	const testSource: Source<TestImport> = {
		parse(url: string, _override: OverrideFn<TestImport>) {
			const m = notNull(url.match(/^(https:\/\/example.com)\/(v[^\/]+)\/(.*)?$/), 'extraction for ' + url)
			const [_match, prefix, version, path] = m
			return {
				import: { prefix, version, path, spec: null },
				spec: {
					identity: url,
					matchesSpec(spec: BumpSpec) { return false },
					show(imp: TestImport) {
						return `${imp.prefix}/${imp.version}/${imp.path}`
					},
					async resolve(_verbose: boolean) {
						return version  +'-new'
					}
				}
			}
		}
	}

	const changes = await Bumper._bump([dir], { verbose: false }, [ testSource ])
	
	assertEquals(await DenoFS.readTextFile(`${dir}/main.ts`), `
		export * from 'https://example.com/v1-new/main.ts'
	`.trim())
	assertEquals(await DenoFS.readTextFile(`${dir}/a/b/c/nested.ts`), `
		export * from 'https://example.com/v1-new/lib/nested.ts'
 `.trim())

	assertEquals(changes, 2)
}))
