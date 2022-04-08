import { assertEquals } from '../common.ts'
import notNull from '../../lib/notNull.ts'
import { Bumper, parseGH } from '../../lib/bump.ts'
import { FakeFS } from '../../lib/fsImpl.ts'

const url = (r: string, spec?: string) => {
	const base = `https://raw.githubusercontent.com/timbertson/dhall-ci/${r}/Meta/package.dhall`
	return spec ? base+'#'+spec : base
}

Deno.test('bump parseGH', () => {
	const base = url('SHA')
	const updated = url('UPDATED')
	assertEquals(parseGH(base)?.imp, {
		owner: "timbertson",
		repo: "dhall-ci",
		prefix: "https://raw.githubusercontent.com",
		version: "SHA",
		spec: null,
		path: "Meta/package.dhall"
	})
	assertEquals(parseGH(base)?.formatVersion('UPDATED'), updated)
	assertEquals(parseGH(url('SHA', 'ref'))?.formatVersion('UPDATED'), updated + '#ref')
})

const testSha = '7fa1accd89e45af5c7e60f904d9710c9f4024315'
Deno.test('bump resolve branch', async () => {
	// override URLs to resolve from local repo
	const spec = 'test-branch-1'
	const source = notNull('parsed', parseGH(url('SHA', spec)))
	const resolved = await source.resolveFrom('.')
	assertEquals(resolved, url(testSha, spec))
})

Deno.test('bump resolve wildcard', async () => {
	// override URLs to resolve from local repo
	const spec = 'test-version-*'
	const source = notNull('parsed', parseGH(url('SHA', spec)))
	const resolved = await source.resolveFrom('.')
	assertEquals(resolved, url(testSha, spec))
})

Deno.test('processImportURLs', async () => {
	const urls: Array<string> = []
	const replaced = await Bumper.processImportURLs(`
		import { foo } from 'https://example.com/mod.ts#main'
		export * as Mod from "http://example.com/mod.ts";

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
