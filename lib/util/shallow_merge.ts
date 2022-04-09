type Partial<T> = {
	[P in keyof T]?: T[P];
}

export default function<T>(a: T, ...rest: Partial<T>[]): T {
	const ret: T = {...a}
	for (const addition of rest) {
		Object.assign(ret, addition)
	}
	return ret
}
