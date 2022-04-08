export class Version {
	prefix: string
	suffix: string
	numbers: Array<number>
	
	constructor(prefix: string, numbers: Array<number>, suffix: string) {
		this.prefix = prefix
		this.suffix = suffix
		this.numbers = numbers
	}
	
	static parse(s: String) {
		const match = s.match(/^([^0-9.]*)([0-9]+(?:\.[0-9]+)+)([^0-9.].*)?$/)
		if (!match) {
			return null
		}
		const [_all, prefix, numStr, suffix] = match
		let numbers = numStr.split('.').map(n => parseInt(n, 10))
		return new Version(prefix, numbers, suffix || '')
	}
	
	format(): string {
		return `${this.prefix}${this.numbers.join('.')}${this.suffix}`
	}
	
	static compare(a: Version, b: Version) {
		function compareIndex(i: number): number {
			const ap = a.numbers[i]
			const bp = b.numbers[i]
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
