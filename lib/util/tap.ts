export default function tap<T>(obj: T, fn: (obj: T) => any): T {
	fn(obj)
	return obj
}
