import { run } from '../lib/cmd.ts'

export default async function main(opts: { args?: Array<string>}): Promise<void> {
	const paths = opts.args ? opts.args : ['test/']
	await run([Deno.execPath(), 'test', '--parallel', '--allow-all'].concat(paths), { fatal: true })
}
