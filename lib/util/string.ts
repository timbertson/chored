export function replaceSuffix(str: string, suffix: string, replacement: string): string {
	if (!str.endsWith(suffix)) {
		throw new Error(`${str} does not end with ${suffix}`)
	}
	return str.substring(0, str.length - suffix.length) + replacement
}

export function joinLines(lines: string[]): string {
	return lines.join('\n')
}

export function trimIndent(str: string): string {
	const lines = str.split('\n')
	
	// collect commonIndent of all non-blank lines
	let commonIndent = null
	for (let lineIndex = 0; lineIndex<lines.length; lineIndex++) {
		const line = lines[lineIndex]
		const trimmed = line.trimStart()
		if (trimmed.length > 0) {
			if (commonIndent === null) {
				commonIndent = line.substring(0, line.length - trimmed.length)
			} else {
				// trim commonIndent to longest common prefix
				for (let indentIndex = 0; indentIndex < commonIndent.length; indentIndex++) {
					if (commonIndent[indentIndex] !== line[indentIndex]) {
						commonIndent = commonIndent.substring(0, indentIndex)
					}
				}
			}
		} else {
			// fully trim empty lines
			lines[lineIndex] = trimmed
		}
	}

	// drop empty leading line
	if (lines[0] === '') {
		lines.splice(0, 1)
	}
	return joinLines(lines.map(line => line.substring(commonIndent.length)))
}
