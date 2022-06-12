import { runOutput } from "../../lib/cmd.ts";
import { DenoFS } from "../../lib/fs/impl.ts";
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import { assertEquals } from "../common.ts";

Deno.test('local dependency map', async (t) => withTempDir({}, async (dir) => {
	const cwd = Deno.cwd()
	const choredefs = `${dir}/choredefs`
	await DenoFS.mkdir(choredefs)
	await DenoFS.writeTextFile(`${choredefs}/index.ts`, `
		import { walk } from 'https://raw.githubusercontent.com/denoland/deno_std/0.133.0/fs/walk.ts#0.133.*'
		import { sort } from 'https://raw.githubusercontent.com/timbertson/chored/8dadebec07917f983d01c7c5cbc5c8dcdcfb42b0/lib/util/collection.ts#8dadebec07917f983d01c7c5cbc5c8dcdcfb42b0'
		import { render } from '${cwd}/lib/render.ts'
		import { importMap, Options } from '${cwd}/lib/localImportMap.ts'
		
		export async function localImportMap(opts: Options) {
			await importMap(opts, {
				chored: 'chored-local',
				deno_std: 'std-local'
			})
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

	const runOpts = {
		env: { CHORED_MAIN: cwd + '/lib/main.ts' },
		cwd: dir
	}

	await t.step('generates a dynamic, local import map', async () => {
		// we don't have a `std` dir, so it should be filtered out
		const output = await runOutput([`${Deno.cwd()}/chored`, '--local', 'printLocal'], runOpts)
		assertEquals(output, 'FAKE SORT!\nfunction')
	})
}))
