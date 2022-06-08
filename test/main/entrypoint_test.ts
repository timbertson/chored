import { assertEquals, assertMatch } from '../common.ts'
import { DenoFS } from '../../lib/fs/impl.ts'
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import { Resolver } from '../../lib/main/entrypoint.ts'
import { Config, defaultConfig } from '../../lib/main/config.ts'
import { run } from "../../lib/cmd.ts";

interface MinimalEntrypoint {
	module: string,
	symbol: string[],
}

async function resolveEntrypoint(c: Config, main: string[]): Promise<MinimalEntrypoint|null> {
	let resolved = await (new Resolver(c)).resolveEntrypoint(main)
	return (resolved == null) ? resolved : {
		module: resolved.module,
		symbol: resolved.symbol,
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
		export const nested = {
			c: function(opts: {}) { return "nested c!" },
			default: function(opts: {}) { return "nested default!" },
		}

		export class ChoreClass {
			constructor(value: {}) {
			}
			static isChoredef = false
		}
	`)
	
	await run(['ln', '-s', 'dynamic.ts', `${dir}/link.ts`], { printCommand: false })

	const moduleURI = (name: string) => `file://${dir}/${name}.ts`
	const config: Config = { ...defaultConfig, taskRoot: dir }
	const resolver = new Resolver(config)
	
	async function listScope(scope: []|[string]) {
		const rv = []
		for await (const s of resolver.entrypointSources(scope, { includeBuiltins: false })) {
			for (const e of await s.entrypoints()) {
				rv.push({ id: e.id, symbol: e.symbol })
			}
		}
		return rv
	}
	
	const indexEntrypoints = [
		{ id: ['b'], symbol: ['b'] },
		{ id: ['default'], symbol: ['default'] },
		{ id: ['nested', 'c'], symbol: ['nested', 'c'] },
		{ id: ['nested', 'default'], symbol: ['nested', 'default'] },
	]

	await t.step("list entrypoints unscoped", async () => {
		const unscoped = await listScope([])
		assertEquals(unscoped,
			[
				{ id: ['a', 'async'], symbol: ['async'] },
				{ id: ['a', 'default'], symbol: ['default'] },
				{ id: ['dynamic', 'impl'], symbol: ['default', 'impl'] },
				{ id: ['link', 'impl'], symbol: ['default', 'impl'] },
			].concat(indexEntrypoints)
		)
	})

	await t.step("list entrypoints scoped", async () => {
		const scoped = await listScope(['a'])

		assertEquals(scoped,
			[
				{ id: ['a', 'async'], symbol: ['async' ] },
				{ id: ['a', 'default'], symbol: ['default' ] },
				
				// from index (scope doesn't filter these out) since it wouldn't save on a module import
			].concat(indexEntrypoints)
		)
	})

	await t.step("file matching task name", async () => {
		assertEquals(await resolver.run(['a'], {}), 'chore a!')
		assertEquals(await resolver.run(['a', 'async'], {}), 'chore a (async)!')
	})

	await t.step("explicit file path", async () => {
		assertEquals(await resolveEntrypoint(config, ['./choredefs/render.ts']), {
			module: `file://${Deno.cwd()}/./choredefs/render.ts`, symbol: ['default']
		})
	})

	await t.step("index / fallback", async () => {
		assertEquals(await resolveEntrypoint(config, ['b']), {
			module: moduleURI('index'), symbol: ['b']
		})
		assertEquals(await resolver.run(['b'], {}), 'index b!')

		assertEquals(await resolveEntrypoint(config, []), {
			module: moduleURI('index'), symbol: ['default']
		})
		assertEquals(await resolver.run([], {}), 'default!')

		assertEquals(await resolveEntrypoint(config, ['c']), null)
	})

	await t.step("dynamically defined", async () => {
		assertEquals(await resolver.run(['dynamic', 'impl'], {}), 'dynamic!')
	})
}))


Deno.test("default.ts", (t) => withTempDir({}, async (dir) => {
	await DenoFS.writeTextFile(`${dir}/default.ts`, `
		export default function(opts: {}) { return "default!" }
	`)

	const moduleURI = (name: string) => `file://${dir}/${name}.ts`
	const config: Config = { ...defaultConfig, taskRoot: dir }
	const resolver = new Resolver(config)

	assertEquals(await resolveEntrypoint(config, []), {
		module: moduleURI('default'), symbol: ['default']
	})
	assertEquals(await resolver.run([], {}), 'default!')
}))
