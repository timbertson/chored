export const MARKER = "NOTE: This file is generated" + " by chored"
const HEADER_LINES = [MARKER]

export function renderHeaderLines(opts: { linePrefix: string, lineSuffix?: string|null }) {
	const prefix = opts.linePrefix + " "
	const suffix = opts.lineSuffix ? (" " + opts.lineSuffix) : ""
	const lines = HEADER_LINES.map(l => prefix + l + suffix)
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

export function writeMode(file: WriteableOpts) {
	let mode = 0o400

	if (file.readOnly === false) {
		mode = mode | 0o200
	}

	if (file.executable === true) {
		mode = mode | 0o100
	}
	
	return mode
}

// minimal type to remove the need to depend on fsimpl
type FSUtil = {
	dirname(path: string): string,
	mkdirp(path: string): Promise<void>,
	forceWriteTextFile(path: string, contents: string, useTemp: boolean, opts: Deno.WriteFileOptions): Promise<void>,
}

export async function writeTo(fsUtil: FSUtil, file: Writeable, useTemp: boolean): Promise<void> {
	await fsUtil.mkdirp(fsUtil.dirname(file.path))
	await fsUtil.forceWriteTextFile(file.path, file.serialize(), useTemp, { mode: writeMode(file) })
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
	headerLinePrefix: string = "#"
	headerLineSuffix: string | null = null

	serialize(): string {
		const header = renderHeaderLines({ linePrefix: this.headerLinePrefix, lineSuffix: this.headerLineSuffix })
		let lines: Array<string> = []
		if (this.value.startsWith("#!")) {
			lines = this.value.split("\n")
			lines.splice(1, 0, ...header)
		} else {
			lines = header
			lines.push(this.value)
		}
		return join(lines)
	}
}

export const GENERATED_ATTR = "chored-generated"
export class GitAttributes extends DerivedFile {
	static default = new GitAttributes([])

	extraLines: Array<string>

	constructor(extraLines: Array<string>) {
		super(".gitattributes")
		this.extraLines = extraLines
	}

	derive(paths: Array<string>): Writeable {
		const value = join(paths.map(p => `${p} linguist-generated ${GENERATED_ATTR}`).concat(this.extraLines))
		return new TextFile(this.path, value)
	}
}
