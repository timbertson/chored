import { assertEquals, assertMatch } from '../common.ts'
import { DenoFS } from '../../lib/fs/impl.ts'
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import { Resolver } from '../../lib/main/entrypoint.ts'
import { Config, defaultConfig } from '../../lib/main/config.ts'
import * as builtins from '../../lib/chore/builtins.ts'

interface MinimalEntrypoint {
	module: string,
	fn: string,
	viaDefault: boolean,
}

async function resolveEntrypoint(c: Config, main: string[]): Promise<MinimalEntrypoint|null> {
	let resolved = await (new Resolver(c)).resolveEntrypoint(main)
	return (resolved == null) ? resolved : {
		module: resolved.module,
		fn: resolved.fn,
		viaDefault: resolved.viaDefault
	}
}

Deno.test("list / run entrypoints", (t) => withTempDir({}, async (dir) => {
	await DenoFS.writeTextFile(`${dir}/a.ts`, `
		export default function(opts: {}) { return "chore a!" }
		export function async(opts: {}) { return Promise.resolve("chore a (async)!") }
	`)

	await DenoFS.writeTextFile(`${dir}/dynamic.ts`, `
		function module() {
			return { impl: function(opts: {}) { return "dynamic!" } }
		}
		export default module()
	`)

	await DenoFS.writeTextFile(`${dir}/index.ts`, `
		export function b(opts: {}) { return "index b!" }
		export default function(opts: {}) { return "default!" }
	`)

	const moduleURI = (name: string) => `file://${dir}/${name}.ts`
	const config: Config = { ...defaultConfig, taskRoot: dir }
	const resolver = new Resolver(config)
	
	const builtinEntrypoints = Object.keys(builtins).map ((k: string) => ({ id: [k], viaDefault: false }) )
	await t.step("list entrypoints unscoped", async () => {
		const unscoped = []
		for await (const s of resolver.entrypointSources(null)) {
			for (const e of await s.entrypoints()) {
				unscoped.push({ id: e.id, viaDefault: e.viaDefault })
			}
		}
		
		assertEquals(unscoped,
			[
				{ id: ['a', 'async'], viaDefault: false },
				{ id: ['a', 'default'], viaDefault: false },
				{ id: ['dynamic', 'impl'], viaDefault: true },
				{ id: ['b'], viaDefault: false },
				{ id: ['default'], viaDefault: false },
			].concat(builtinEntrypoints)
		)
	})

	await t.step("list entrypoints scoped", async () => {
		const scoped = []
		for await (const s of resolver.entrypointSources('a')) {
			for (const e of await s.entrypoints()) {
				scoped.push({ id: e.id, viaDefault: e.viaDefault })
			}
		}

		assertEquals(scoped,
			[
				{ id: ['a', 'async'], viaDefault: false },
				{ id: ['a', 'default'], viaDefault: false },
				
				// from index (scope doesn't filter these out) since it wouldn't save on a module import
				{ id: ['b'], viaDefault: false },
				{ id: ['default'], viaDefault: false },
			].concat(builtinEntrypoints)
		)
	})

	await t.step("file matching task name", async () => {
		assertEquals(await resolver.run(['a'], {}), 'chore a!')
		assertEquals(await resolver.run(['a', 'async'], {}), 'chore a (async)!')
	})

	await t.step("explicit file path", async () => {
		assertEquals(await resolveEntrypoint(config, ['./choredefs/render.ts']), {
			module: `file://${Deno.cwd()}/./choredefs/render.ts`, fn: 'default', viaDefault: false
		})
	})

	await t.step("index / fallback", async () => {
		assertEquals(await resolveEntrypoint(config, ['b']), {
			module: moduleURI('index'), fn: 'b', viaDefault: false
		})
		assertEquals(await resolver.run(['b'], {}), 'index b!')

		assertEquals(await resolveEntrypoint(config, []), {
			module: moduleURI('index'), fn: 'default', viaDefault: false
		})
		assertEquals(await resolver.run([], {}), 'default!')

		assertEquals(await resolveEntrypoint(config, ['c']), null)
	})

	await t.step("dynamically defined", async () => {
		assertEquals(await resolver.run(['dynamic', 'impl'], {}), 'dynamic!')
	})
}))
