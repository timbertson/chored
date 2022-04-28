export function sort<T>(items: T[], cmp?: (a: T, b: T) => number): T[] {
	items.sort(cmp)
	return items
}

export function dedupeSort<T>(items: T[], cmp?: (a: T, b: T) => number): T[] {
	return sort(dedupe(items))
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
