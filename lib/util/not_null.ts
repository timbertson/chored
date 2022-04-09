export default function notNull<T>(v: T|undefined|null, desc?: string): T {
	if (v == null) {
		const msg = desc ? `Error: ${desc} is null` : 'Error: unexpected null'
		throw new Error(msg)
	}
	return v
}
