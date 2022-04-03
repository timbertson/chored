// Code for writing out a set of generated files
import { FS, DenoFS, FSUtil } from '../fsImpl.ts'
import { Writeable, GitAttributes, GENERATED_ATTR } from './fileInternal.ts'
export * from './file.ts'

export type Options = {
	gitattributesExtra?: Array<string>
}

export async function render(files: Array<Writeable>, options?: Options, fsOverride?: FS): Promise<void> {
	options = options || {}
	const allPaths = files.map(f =>f.path)
	allPaths.push(GitAttributes.default.path)
	allPaths.sort()

	const attributesFile = new GitAttributes(options.gitattributesExtra || []).derive(allPaths)
	
	const fs = fsOverride || DenoFS
	const fsUtil = FSUtil(fs)
	let previousPaths: Array<string> = []
	try {
		const fileContents = await fs.readTextFile(attributesFile.path)
		previousPaths = generatedFromGitAttributes(fileContents)
	} catch (err) {
		if (fsUtil.isNotFound(err)) {
			console.warn(`Can't check generated files in ${attributesFile.path}; assuming this is the first file generation run`)
		} else {
			throw err
		}
	}
	
	const toRemove = previousPaths.filter(p => allPaths.indexOf(p) == -1)
	await Promise.all(toRemove.map(p => fs.remove(p)))
	
	// always write attributes file first, so that if anything fails we've
	// at least recorded all files
	const attributesTmp = attributesFile.path + '.tmp'
	fs.writeTextFile(attributesTmp, attributesFile.serialize())
	await fs.rename(attributesTmp, attributesFile.path)
	for (let file of files) {
		await fsUtil.mkdirp(fsUtil.dirname(file.path))
		await fs.writeTextFile(file.path, file.serialize())
	}
	console.warn(`Generated ${files.length + 1} files`)
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
