// code for defining files (but not actually rendering them anywhere)
import * as YAML from "../util/yaml_stringify.ts"

import { Writeable, BaseFile, TextFile, MARKER, join, renderHeaderLines } from './file_internal.ts'
export { TextFile } from './file_internal.ts'
export type { Writeable }

type JSObj = { [index: string]: any }

export class JSONFile extends BaseFile<JSObj> implements Writeable {
	serialize(): string {
		let vs = { '//': MARKER, ...this.value }
		return JSON.stringify(vs, null, 2)
	}
}

export class YAMLFile extends BaseFile<any> implements Writeable {
	serialize(): string {
		const lines = renderHeaderLines({ linePrefix: "#" })
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
}

export class HTMLFile extends TextFile {
	headerLinePrefix: string = "<!--"
	headerLineSuffix: string = "-->"
}

export const MarkdownFile = HTMLFile
