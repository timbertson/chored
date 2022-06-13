export const namedIndexes = ["major", "minor", "patch"]
export type Index = number | 'major' | 'minor' | 'patch'

export function resolveIndex(i: Index): number {
	if (i === 'major') return 0
	if (i === 'minor') return 1
	if (i === 'patch') return 2
	return i
}

export class Version {
	parts: number[]

	constructor(parts: number[]) {
		this.parts = parts
	}
	
	show() {
		return this.parts.join('.')
	}

	tag(): string {
		return "v" + this.show()
	}

	static parsePart(p: string) {
		const digits = p.match(/^[0-9]+$/)
		if (digits == null) {
			throw new Error("Invalid version component: " + p)
		}
		return parseInt(p, 10)
	}

	static split(v: string) {
		if (v[0] == 'v') {
			v = v.slice(1)
		}
		return v.split('.')
	}

	static parse(v: string): Version {
		return new Version(Version.split(v).map(Version.parsePart))
	}

	static parseLax(s: String) {
		const stripped = s.replaceAll(/(^[^0-9]*)|([^0-9]*$)/g, '')
		try {
			return Version.parse(stripped)
		} catch (_e: any) {
			return null
		}
	}

	static compare(a: Version, b: Version) {
		function compareIndex(i: number): number {
			const ap = a.parts[i]
			const bp = b.parts[i]
			if (ap == null) {
				if (bp == null) {
					// totally equal
					return 0
				} else {
					return -1 // a < b
				}
			} else if (bp == null) {
				return 1
			} else {
				// both non-null
				if (ap !== bp) {
					return ap - bp
				} else {
					// tiebreaker
					return compareIndex(i+1)
				}
			}
		}
		return compareIndex(0)
	}
}
