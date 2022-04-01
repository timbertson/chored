// code for defining files (but not actually rendering them anywhere)
import * as YAML from "../yaml-stringify.ts"
import * as Util from "./util.ts"

export interface Writeable {
	path: string,
	readOnly?: boolean,
	executable?: boolean
}

export interface BaseFile extends Writeable {
	serialize: () => string,
}

export interface DerivedFile extends Writeable {
	serialize: (paths: Array<string>) => string,
}

type JSObj = { [index: string]: any }

export class JSONFile implements BaseFile {
	value: JSObj
	path: string

	constructor(path: string, value: JSObj) {
		this.path = path
		this.value = value
	}

	serialize(): string {
		let vs = { '//': Util.MARKER, ...this.value }
		return JSON.stringify(vs, null, 2)
	}
}

export class YAMLFile implements BaseFile {
	value: any
	path: string

	constructor(path: string, value: any) {
		this.path = path
		this.value = value
	}

	serialize(): string {
		const lines = Util.renderHeaderLines({ linePrefix: "# " })
		lines.push(YAML.stringify(this.value))
		return Util.join(lines)
	}
}

export class RawFile implements BaseFile {
	value: string
	path: string

	constructor(path: string, value: string) {
		this.path = path
		this.value = value
	}

	serialize(): string {
		return this.value
	}
}

export class TextFile implements BaseFile {
	value: string
	path: string

	constructor(path: string, value: string) {
		this.path = path
		this.value = value
	}

	serialize(): string {
		const lines = Util.renderHeaderLines({ linePrefix: "# " })
		lines.push(this.value)
		return Util.join(lines)
	}
}

export class ExecutableFie extends TextFile {
	executable: boolean = true

	serialize(): string {
		const header = Util.renderHeaderLines({ linePrefix: "# " })
		let lines: Array<string> = []
		if (this.value.startsWith("#!")) {
			lines = this.value.split("\n")
			lines.splice(1, 0, ...header)
		} else {
			lines = header
			lines.push(this.value)
		}
		lines.push(this.value)
		return Util.join(lines)
	}
}

export class GitAttributes implements DerivedFile {
	static default = new GitAttributes(".gitattributes", [])

	path: string
	extraLines: Array<string>

	constructor(path: string, extraLines: Array<string>) {
		this.path = path
		this.extraLines = extraLines
	}

	serialize(paths: Array<string>): string {
		const lines = [...Util.renderHeaderLines({ linePrefix: "# " }), ...paths.map(p => `${p} linguist-generated`)]
		return Util.join(lines)
	}
}


export class GitAttributes implements DerivedFile {
	static default = new GitAttributes(".gitattributes", [])

	path: string
	extraLines: Array<string>

	constructor(path: string, extraLines: Array<string>) {
		this.path = path
		this.extraLines = extraLines
	}

	serialize(paths: Array<string>): string {
		const lines = [...Util.renderHeaderLines({ linePrefix: "# " }), ...paths.map(p => `${p} linguist-generated denon-generated`)]
		return Util.join(lines)
	}
}
