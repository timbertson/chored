import { assertEquals, assertExists } from '../common.ts'
import { describeWithAutoDeepen } from '../../lib/git/describe_impl.ts'
import { Ctx } from './ctx.ts'

Deno.test('describeWithAutoDeepen', async (t) => {
	const describeOutput = 'v1.0-53-gd14d21c'
	const fetches = (c: Ctx) => c.audit.get().filter((cmd: string[]) => cmd[1] === 'fetch')

	await t.step('describe on a deep repository', async () => {
		const c = new Ctx()
		c.respond(['git', 'describe'], describeOutput)
		assertEquals({ ... await describeWithAutoDeepen(c.runner, 'HEAD'), commit: 'HEAD'}, {
			commit: 'HEAD',
			tag: 'v1.0',
			isExact: false
		})
		assertEquals(fetches(c), [])
	})

	await t.step('describe with no tags', async () => {
		const c = new Ctx()
		c.respond(['git', 'describe'], 'abcd')
		assertEquals((await describeWithAutoDeepen(c.runner, 'HEAD')).tag, null)
		assertEquals(fetches(c), [])
	})

	await t.step('describe on a shallow repository', async () => {
		const c = new Ctx()
		c.respond(['stat'], true)
		c.respond(['git', 'describe'], false)
		c.respond(['git', 'describe'], describeOutput)
		assertExists(await describeWithAutoDeepen(c.runner, 'HEAD'))
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
		assertExists(await describeWithAutoDeepen(c.runner, 'HEAD'))
		assertEquals(fetches(c), [
			['git', 'fetch', '--deepen', '100'],
			['git', 'fetch', '--deepen', '100'],
			['git', 'fetch', '--deepen', '100'],
			['git', 'fetch', '--unshallow', '--tags']
		])
	})
})
