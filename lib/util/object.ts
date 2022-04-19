
export function notNull<T>(v: T|undefined|null, desc?: string): T {
	if (v == null) {
		const msg = desc ? `Error: ${desc} is null` : 'Error: unexpected null'
		throw new Error(msg)
	}
	return v
}

type Partial<T> = {
	[P in keyof T]?: T[P];
}

export function merge<T>(a: T, ...rest: Partial<T>[]): T {
	const ret: T = {...a}
	for (const addition of rest) {
		Object.assign(ret, addition)
	}
	return ret
}

export function tap<T>(obj: T, fn: (obj: T) => any): T {
	fn(obj)
	return obj
}
