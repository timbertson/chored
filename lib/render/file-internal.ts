export const MARKER = "NOTE: This file is generated" + " by denon"
const HEADER_LINES = [MARKER]

export function renderHeaderLines(opts: { linePrefix: string }) {
	const lines = HEADER_LINES.map(l => opts.linePrefix + l)
	lines.push("")
	return lines
}

export function join(lines: Array<string>) { return lines.join("\n") }

export interface WriteableOpts {
	readOnly?: boolean,
	executable?: boolean
}

export interface FileMeta extends WriteableOpts {
	path: string,
}

export interface Writeable extends FileMeta {
	serialize(): string
}

export abstract class BaseFile<T> {
	path: string
	value: T
	constructor(path: string, value: T) {
		this.path = path
		this.value = value
	}

	abstract serialize(): string

	set(opts: WriteableOpts): this {
		Object.assign(this, opts)
		return this
	}
}

export abstract class DerivedFile {
	path: string

	constructor(path: string) {
		this.path = path
	}

	abstract derive(paths: Array<string>): Writeable
}

export class TextFile extends BaseFile<string> implements Writeable {
	serialize(): string {
		const lines = renderHeaderLines({ linePrefix: "# " })
		lines.push(this.value)
		return join(lines)
	}
}


export const GENERATED_ATTR = "denon-generated"
export class GitAttributes extends DerivedFile {
	static default = new GitAttributes(".gitattributes", [])

	extraLines: Array<string>

	constructor(path: string, extraLines: Array<string>) {
		super(path)
		this.extraLines = extraLines
	}

	derive(paths: Array<string>): Writeable {
		const value = join(paths.map(p => `${p} linguist-generated ${GENERATED_ATTR}`).concat(this.extraLines))
		return new TextFile(this.path, value)
	}
}
