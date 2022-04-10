export default function replaceSuffix(str: string, suffix: string, replacement: string): string {
	if (!str.endsWith(suffix)) {
		throw new Error(`${str} does not end with ${suffix}`)
	}
	return str.substring(0, str.length - suffix.length) + replacement
}
