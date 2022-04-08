import { assertEquals } from './common.ts'
import notNull from '../lib/notNull.ts'
import * as Bump from '../lib/bump.ts'

const url = (r: string, spec?: string) => {
	const base = `https://raw.githubusercontent.com/timbertson/dhall-ci/${r}/Meta/package.dhall`
	return spec ? base+'#'+spec : base
}

Deno.test('bump parseGH', () => {
	const base = url('SHA')
	const updated = url('UPDATED')
	assertEquals(Bump.parseGH(base)?.imp, {
		owner: "timbertson",
		repo: "dhall-ci",
		prefix: "https://raw.githubusercontent.com",
		version: "SHA",
		spec: null,
		path: "Meta/package.dhall"
	})
	assertEquals(Bump.parseGH(base)?.formatVersion('UPDATED'), updated)
	assertEquals(Bump.parseGH(url('SHA', 'ref'))?.formatVersion('UPDATED'), updated + '#ref')
})

const testSha = '7fa1accd89e45af5c7e60f904d9710c9f4024315'
Deno.test('bump resolve branch', async () => {
	// override URLs to resolve from local repo
	const spec = 'test-branch-1'
	const source = notNull('parsed', Bump.parseGH(url('SHA', spec)))
	const resolved = await source.resolveFrom('.')
	assertEquals(resolved, url(testSha, spec))
})

Deno.test('bump resolve wildcard', async () => {
	// override URLs to resolve from local repo
	const spec = 'test-version-*'
	const source = notNull('parsed', Bump.parseGH(url('SHA', spec)))
	const resolved = await source.resolveFrom('.')
	assertEquals(resolved, url(testSha, spec))
})
