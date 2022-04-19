export function sort<T>(items: T[], cmp?: (a: T, b: T) => number): T[] {
	items.sort(cmp)
	return items
}

export function dedupe<T>(items: T[]): T[] {
	return sort(Array.from(new Set(items)))
}

export function equalSets<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size === b.size && Array.from(a).every((elem :T) => b.has(elem))
}
