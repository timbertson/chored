import { run } from '../lib/cmd.ts'

export async function main(_: {}): Promise<void> {
	await run([Deno.execPath(), 'test', '--allow-run', 'test/'])
}
