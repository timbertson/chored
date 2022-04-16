export default async function withTempFile<T>(opts: Deno.MakeTempOptions, action: (dir: string) => Promise<T>): Promise<T> {
	const path = await Deno.makeTempFile(opts)
	let ret: T
	try {
		ret = await action(path)
	} finally {
		await Deno.remove(path)
	}
	return ret
}
