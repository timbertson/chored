export function sort<T>(items: T[], cmp?: (a: T, b: T) => number): T[] {
	items.sort(cmp)
	return items
}

export function dedupeSort<T>(items: T[], cmp?: (a: T, b: T) => number): T[] {
	return sort(dedupe(items))
}

export function partition<T>(items: T[], fn: (t: T) => Boolean): [T[], T[]] {
	const t: T[] = []
	const f: T[] = []
	for (const i of items) {
		((fn(i)) ? t : f).push(i)
	}
	return [t,f]
}

export function dedupe<T>(items: T[]): T[] {
	const rv: T[] = []
	for (const t of items) {
		if (rv.indexOf(t) === -1) {
			rv.push(t)
		}
	}
	return rv
}

export function equalSets<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size === b.size && Array.from(a).every((elem :T) => b.has(elem))
}

export function equalArrays<T>(a: Array<T>, b: Array<T>): boolean {
	if (a.length !== b.length) {
		return false
	}
	for (let i=0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	return true
}
