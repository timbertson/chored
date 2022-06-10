import { run, runOutput } from "../../lib/cmd.ts";
import { DenoFS } from "../../lib/fs/impl.ts";
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import { assertEquals } from "../common.ts";

Deno.test('local dependency map', async (t) => withTempDir({}, async (dir) => {
	const cwd = Deno.cwd()
	const choredefs = `${dir}/choredefs`
	await DenoFS.mkdir(choredefs)
	await DenoFS.writeTextFile(`${choredefs}/render.ts`, `
		import { walk } from 'https://raw.githubusercontent.com/denoland/deno_std/0.133.0/fs/walk.ts#0.133.*'
		import { sort } from 'https://raw.githubusercontent.com/timbertson/chored/8dadebec07917f983d01c7c5cbc5c8dcdcfb42b0/lib/util/collection.ts#main'
		import { render } from '${cwd}/lib/render.ts'
		
		export default async function(opts: {}) {
			await render([], { localDeps: {
				sources: {
					chored: 'chored-local',
					deno_std: 'std-local'
				}
			}})
		}

		export function printLocal(opts: {}) {
			console.log(sort([1]))
			console.log(typeof(walk))
		}
	`)
	
	await DenoFS.mkdirp(`${dir}/chored-local/lib/util`)
	await DenoFS.writeTextFile(`${dir}/chored-local/lib/util/collection.ts`, `
		export function sort<T>(items: Array<T>) {
			return "FAKE SORT!"
		}
	`)

	const imports = {
		"https://raw.githubusercontent.com/denoland/deno_std/0.133.0/": "std-local/",
		"https://raw.githubusercontent.com/timbertson/chored/8dadebec07917f983d01c7c5cbc5c8dcdcfb42b0/": "chored-local/",
	}
	const runOpts = {
		env: { CHORED_MAIN: cwd + '/lib/main.ts' },
		cwd: dir
	}

	await t.step('generates local-deps.json', async () => {
		await run([`${cwd}/chored`, 'render'], runOpts)
		const json = JSON.parse(await DenoFS.readTextFile(`${choredefs}/local-deps.json`))
		assertEquals(json, { imports })
	})

	await t.step('filters dependencies to extant paths', async () => {
		// we don't have a `std` dir, so it should be filtered out
		const output = await runOutput([`${Deno.cwd()}/chored`, '--local', 'render', 'printLocal'], runOpts)
		assertEquals(output, 'FAKE SORT!\nfunction')
	})
}))
