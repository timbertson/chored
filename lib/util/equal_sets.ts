export default function equalSets<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size === b.size && Array.from(a).every((elem :T) => b.has(elem))
}
