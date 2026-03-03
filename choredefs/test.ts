import { run } from '../lib/cmd.ts'

export default async function main(opts: { parallel?: boolean, args?: Array<string>}): Promise<void> {
	const paths = opts.args ? opts.args : ['test/']
	const parallelArg = opts.parallel === false ? [] : ['--parallel']
	await run([Deno.execPath(), 'test', '--allow-all'].concat(parallelArg, paths), { fatal: true })
}
