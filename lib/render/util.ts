export const MARKER = "NOTE: This file is generated" + " by denon"
const HEADER_LINES = [MARKER]

export function renderHeaderLines(opts: { linePrefix: string }) {
	const lines = HEADER_LINES.map(l => opts.linePrefix + l)
	lines.push("")
	return lines
}

export function join(lines: Array<string>) { return lines.join("\n") }
