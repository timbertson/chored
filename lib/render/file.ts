// code for defining files (but not actually rendering them anywhere)
import { joinLines } from "../util/string.ts";
import * as YAML from "../util/yaml_stringify.ts"

import { File, BaseFile, TextFile, MARKER, renderHeaderLines } from './file_internal.ts'
export { TextFile } from './file_internal.ts'
export type { File }

type JSObj = { [index: string]: any }

export class JSONFile extends BaseFile<JSObj> implements File {
	serialize(): string {
		let vs = { '//': MARKER, ...this.value }
		return JSON.stringify(vs, null, 2)
	}
}

export class YAMLFile extends BaseFile<any> implements File {
	serialize(): string {
		const lines = renderHeaderLines({ linePrefix: "#" })
		lines.push(YAML.stringify(this.value))
		return joinLines(lines)
	}
}

export class RawFile extends BaseFile<string> implements File {
	serialize(): string {
		return this.value
	}
}

export class CFile extends TextFile {
	headerLinePrefix: string = "//"
}

export class ExecutableFile extends TextFile {
	executable: boolean = true
}

export class HTMLFile extends TextFile {
	headerLinePrefix: string = "<!--"
	headerLineSuffix: string = "-->"
}

export const MarkdownFile = HTMLFile
