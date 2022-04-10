import { run } from '../cmd.ts'

export default async function withTempDir<T>(opts: Deno.MakeTempOptions, action: (dir: string) => Promise<T>): Promise<T> {
	const dir = await Deno.makeTempDir(opts)
	let ret: T
	try {
		ret = await action(dir)
	} finally {
		await run(['rm', '-rf', dir], { printCommand: false })
	}
	return ret
}
