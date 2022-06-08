import { assertEquals, assertThrows } from '../common.ts'
import { defaultContext, defaultOptions, Engine, nextVersion, NextVersionOptions, parseCommitLines, VersionTemplate } from '../../lib/version/bump_impl.ts'
import { Ctx } from '../git/ctx.ts'
import { notNull } from "../../lib/util/object.ts";
import { Version } from "../../lib/version.ts";

Deno.test('VersionTemplate', () => {
	function t(s: string) {
		return VersionTemplate.parse('1.2.3').parts
	}
	assertEquals(t('1.2.3'), [1,2,3])
	assertEquals(t('1.x.3'), [1,2,3])
	assertEquals(VersionTemplate.unrestricted(3).parts, ['x','x','x'])
	assertEquals(VersionTemplate.parse('1').isFree(0), false)
	assertEquals(VersionTemplate.parse('1').isFree(1), true)

	assertThrows(() => VersionTemplate.parse('1.x.2'), undefined, 'Invalid version template')
	assertThrows(() => VersionTemplate.parse('1.x.-'), undefined, 'Invalid version template')
})

Deno.test('nextVersion', () => {
	function n(t: string, v: string, opts?: NextVersionOptions): string {
		return nextVersion(
			notNull(VersionTemplate.parse(t)),
			Version.parse(v),
			opts ?? { index: null }
		).show()
	}
	
	assertEquals(n('1.x.0', '1.1.2'), '1.2.0')
	assertEquals(n('1.x.0', '0.1'), '1.0.0')
	assertEquals(n('x.x', '0.1'), '0.2')
	assertEquals(n('x.x.0', '0.1'), '0.2.0')
	assertEquals(n('x.x.0', '0.1'), '0.2.0')
	assertEquals(n('1.2', '1.2'), '1.2.1')
	assertEquals(n('1.2', '0.2'), '1.2.0')
	assertEquals(n('1.x.x.x', '0.1.2.3'), '1.0.0.0')

	assertEquals(n('x.x', '0.2', { index: 'major' }), '1.0')
	assertEquals(n('x.0', '0.2', { defaultBump: 'minor', index: null }), '1.0')
	assertThrows(() => n('1.x', '0.2', { index: 'major' }), undefined,
		'Requested index (major) is incompatible with version template: 1.x')
	assertThrows(() => n('1.x.0', '0.2', { index: 'patch' }), undefined,
		'Requested index (patch) is incompatible with version template: 1.x.0')
})

Deno.test('directive parsing', () => {
	assertEquals(parseCommitLines('abcd [release] commit'), { release: true, index: null })
	assertEquals(parseCommitLines('abcd [release] commit\nabcd [major] commit'), { release: true, index: 'major' })
	assertEquals(parseCommitLines('abcd [patch] commit'), { release: false, index: 'patch' })
	assertEquals(parseCommitLines('abcd [minor-release] commit'), { release: true, index: 'minor' })
})

Deno.test('Engine', async (t) => {
	await t.step('skips if already tagged', async () => {
		const c = new Ctx()
		c.respond(['git', 'describe'], 'v1.1-0-gd14d21c')
		const engine = new Engine(c.runner, defaultContext)
		assertEquals(await engine.bump({
			...defaultOptions,
			versionTemplate: VersionTemplate.unrestricted(3)
		}), null)
	})

	await t.step('applyVersion', async () => {
		const v = Version.parse('1.2.3')
		const c = new Ctx()
		const engine = new Engine(c.runner, defaultContext)
		await engine.applyVersion('print', v)
		assertEquals(c.audit.reset(), [])

		await engine.applyVersion('tag', v)
		assertEquals(c.audit.reset(), [['git', 'tag', 'v1.2.3', 'HEAD']])

		await engine.applyVersion('push', v)
		assertEquals(c.audit.reset(), [
			['git', 'tag', 'v1.2.3', 'HEAD'],
			['git', 'push', 'origin', 'tag', 'v1.2.3'],
		])
	})
})
