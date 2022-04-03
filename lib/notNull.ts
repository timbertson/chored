export default function notNull<T>(desc: string, v: T|undefined|null): T {
	if (v == null) {
		throw new Error(`Error: ${desc} is null`)
	}
	return v
}
