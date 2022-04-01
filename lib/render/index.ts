// Code for writing out a set of generated files
import { isNotFound } from '../fs.ts'
import { Writeable, DerivedFile, GitAttributes, GENERATED_ATTR } from './file-internal.ts'
export * from './file.ts'

export type Options = {
	files: Array<Writeable>,
}

export async function write(options: Options) {
	const derivedFiles: Array<DerivedFile> = [GitAttributes.default]
	const allPaths = derivedFiles.map(f => f.path).concat(options.files.map(f =>f.path))
	allPaths.sort()
	const files: Array<Writeable> = options.files.slice()
	for (let file of derivedFiles) {
		files.push(file.derive(allPaths))
	}
	
	let previousPaths: Array<string> = []
	try {
		previousPaths = generatedFromGitAttributes(await Deno.readTextFile(GitAttributes.default.path))
	} catch (err) {
		if (isNotFound(err)) {
			console.warn(`Can't check generated files in ${GitAttributes.default.path}; assuming this is the first file generation run`)
		} else {
			throw err
		}
	}
	
	const toRemove = previousPaths.filter(p => allPaths.indexOf(p) == -1)
	console.warn("WARN removing", toRemove)
	
	for (let file of files) {
		console.log("###### ", file.path)
		console.log(file.serialize())
		console.log("====================\n\n\n\n")
	}
}

export function generatedFromGitAttributes(contents: string): Array<string> {
	return (contents.split("\n")
		.map(l => l.trim())
		.filter(l => !l.startsWith("#"))
		.map(l => l.split(/\s+/))
		.filter(l => l.lastIndexOf(GENERATED_ATTR) > 0)
		.map(l => l[0])
		.filter(path => path != null)
	)
}
