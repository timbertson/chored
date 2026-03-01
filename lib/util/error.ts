export function toError(e: Error | unknown): Error {
	return (e instanceof Error) ? e : new Error(String(e))
}
