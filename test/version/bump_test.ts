import { assertEquals, assertThrows, assertExists } from '../common.ts'
import { CmdRunner, Context, defaultContext, defaultOptions, Engine, nextVersion, NextVersionOptions, parseCommitLines, VersionTemplate } from '../../lib/version/bump_impl.ts'
import { notNull } from "../../lib/util/object.ts";
import { Version } from "../../lib/version.ts";
import { Audit } from "../../lib/test/audit.ts";
import { equalArrays } from "../../lib/util/collection.ts";

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

class Ctx {
	private responses: Array<[string[], string | boolean]> = []
	audit: Audit<string[]> = new Audit()
	engine: Engine
	
	constructor(ctx: Context = defaultContext) {
		const self = this
		const runner: CmdRunner = {
			run: async (cmd: string[]) => {
				const success = self.consumeBool(cmd, true)
				if (!success) {
					throw new Error("cmd failed")
				}
			},
			runOutput: async (cmd: string[], opts?: { allowFailure?: boolean }) => {
				const r = self.consumeResponse(cmd)
				if (r === false) {
					if (opts?.allowFailure === true) {
						return ''
					} else {
						throw new Error(`injected command failure: ${cmd.join(' ')}`)
					}
				} else if (r === true) {
					throw new Error(`Unexpected response type: ${r}`)
				}
				return r
			},
			exists: async (p: string) => {
				return self.consumeBool(['stat', p], false)
			}
		}
		this.engine = new Engine(runner, ctx)
	}
	
	private consumeBool(cmd: string[], dfl: boolean|null = null): boolean {
		const r = this.consumeResponse(cmd, dfl)
		if (!(r === true || r === false)) {
			throw new Error(`Unexpected response type: ${r}`)
		}
		return r
	}

	private consumeResponse(cmd: string[], dfl: string|boolean|null = null): string|boolean {
		this.audit.record(cmd)
		const i = this.responses.findIndex(([prefix, _]) =>
			equalArrays(prefix, cmd.slice(0, prefix.length))
		)
		if (i === -1) {
			if (dfl != null) {
				return dfl
			} else {
				throw new Error(`Unexpected command: ${cmd.join(' ')}`)
			}
		}
		const response = this.responses[i][1]
		this.responses.splice(i, 1)
		return response
	}
	
	respond(prefix: string[], r: string|boolean): this {
		this.responses.push([prefix, r])
		return this
	}
}

Deno.test('Engine', async (t) => {
	const describeOutput = 'v1.0-53-gd14d21c'
	const fetches = (c: Ctx) => c.audit.get().filter(cmd => cmd[1] === 'fetch')

	await t.step('describe on a deep repository', async () => {
		const c = new Ctx()
		c.respond(['git', 'describe'], describeOutput)
		assertEquals(await c.engine.describeWithAutoDeepen(), {
			version: Version.parse('1.0'),
			tag: 'v1.0',
			isExact: false
		})
		assertEquals(fetches(c), [])
	})

	await t.step('describe with no tags', async () => {
		const c = new Ctx()
		c.respond(['git', 'describe'], 'abcd')
		assertEquals(await c.engine.describeWithAutoDeepen(), null)
		assertEquals(fetches(c), [])
	})

	await t.step('describe on a shallow repository', async () => {
		const c = new Ctx()
		c.respond(['stat'], true)
		c.respond(['git', 'describe'], false)
		c.respond(['git', 'describe'], describeOutput)
		assertExists(await c.engine.describeWithAutoDeepen())
		assertEquals(fetches(c), [
			['git', 'fetch', '--deepen', '100'],
		])
	})

	await t.step('describe on a shallow repository which doesnt fetch tags until unshallow', async () => {
		const c = new Ctx()
		c.respond(['stat'], true)
		c.respond(['git', 'describe'], false)
		c.respond(['git', 'describe'], false)
		c.respond(['git', 'describe'], false)
		c.respond(['git', 'describe'], false)
		c.respond(['git', 'describe'], describeOutput)
		assertExists(await c.engine.describeWithAutoDeepen())
		assertEquals(fetches(c), [
			['git', 'fetch', '--deepen', '100'],
			['git', 'fetch', '--deepen', '100'],
			['git', 'fetch', '--deepen', '100'],
			['git', 'fetch', '--unshallow', '--tags']
		])
	})
	
	await t.step('skips if already tagged', async () => {
		const c = new Ctx()
		c.respond(['git', 'describe'], 'v1.1-0-gd14d21c')
		assertEquals(await c.engine.bump({
			...defaultOptions,
			versionTemplate: VersionTemplate.unrestricted(3)
		}), null)
	})

	await t.step('directive parsing', async () => {
		assertEquals(parseCommitLines('abcd [release] commit'), { release: true, index: null })
		assertEquals(parseCommitLines('abcd [release] commit\nabcd [major] commit'), { release: true, index: 'major' })
		assertEquals(parseCommitLines('abcd [patch] commit'), { release: false, index: 'patch' })
		assertEquals(parseCommitLines('abcd [minor-release] commit'), { release: true, index: 'minor' })
	})

	await t.step('applyVersion', async () => {
		const v = Version.parse('1.2.3')
		const c = new Ctx()
		await c.engine.applyVersion('print', v)
		assertEquals(c.audit.reset(), [])

		await c.engine.applyVersion('tag', v)
		assertEquals(c.audit.reset(), [['git', 'tag', 'v1.2.3', 'HEAD']])

		await c.engine.applyVersion('push', v)
		assertEquals(c.audit.reset(), [
			['git', 'tag', 'v1.2.3', 'HEAD'],
			['git', 'push', 'origin', 'tag', 'v1.2.3'],
		])
	})
})
