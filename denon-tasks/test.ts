import { run } from '../lib/cmd.ts'

export function main(opts: {}) {
	run([Deno.execPath(), 'test', 'test/'])
}
