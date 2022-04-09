import { run } from '../lib/cmd.ts'

export async function main(opts: { args?: Array<string>}): Promise<void> {
	const paths = opts.args ? opts.args : ['test/']
	await run([Deno.execPath(), 'test', '--allow-all'].concat(paths), { fatal: true })
}
