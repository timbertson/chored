// code for defining files (but not actually rendering them anywhere)
import * as YAML from "../yaml-stringify.ts"

import { Writeable, BaseFile, TextFile, MARKER, join, renderHeaderLines  } from './file-internal.ts'
export { TextFile } from './file-internal.ts'

type JSObj = { [index: string]: any }

export class JSONFile extends BaseFile<JSObj> implements Writeable {
	serialize(): string {
		let vs = { '//': MARKER, ...this.value }
		return JSON.stringify(vs, null, 2)
	}
}

export class YAMLFile extends BaseFile<any> implements Writeable {
	serialize(): string {
		const lines = renderHeaderLines({ linePrefix: "# " })
		lines.push(YAML.stringify(this.value))
		return join(lines)
	}
}

export class RawFile extends BaseFile<string> implements Writeable {
	serialize(): string {
		return this.value
	}
}

export class ExecutableFile extends TextFile {
	executable: boolean = true

	serialize(): string {
		const header = renderHeaderLines({ linePrefix: "# " })
		let lines: Array<string> = []
		if (this.value.startsWith("#!")) {
			lines = this.value.split("\n")
			lines.splice(1, 0, ...header)
		} else {
			lines = header
			lines.push(this.value)
		}
		lines.push(this.value)
		return join(lines)
	}
}
