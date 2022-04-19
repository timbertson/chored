export default function dedupe<T>(items: T[]): T[] {
	const ret = Array.from(new Set(items))
	ret.sort()
	return ret
}
