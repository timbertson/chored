import { run } from '../lib/cmd.ts'

export default async function main(opts: { args?: Array<string>}): Promise<void> {
	const paths = opts.args ? opts.args : []
	await run([Deno.execPath(), 'lint'].concat(paths), { fatal: true })
}
