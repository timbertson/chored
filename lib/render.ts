// Code for writing out a set of generated files
import { FS, DenoFS, FSUtil } from './fs/impl.ts'
import { File, GitAttributes, GENERATED_ATTR, writeTo } from './render/file_internal.ts'
export * from './render/file.ts'
import { wrapperScript } from './render/bootstrap.ts'
import { file as localDepsFile, Options as LocalOptions } from "./deps/local.ts"
export { wrapperScript } from './render/bootstrap.ts'

export type Options = {
	gitattributesExtra?: Array<string>,
	wrapperScript?: boolean | File,
	localDeps?: LocalOptions
}

export async function render(files: Array<File>, options?: Options, fsOverride?: FS): Promise<void> {
	options = options || {}
	files = files.slice()
	if (options.wrapperScript !== false) {
		const script = (
			(options.wrapperScript === true || options.wrapperScript == null)
			? wrapperScript({})
			: options.wrapperScript
		)
		files.push(script)
	}
	if (options.localDeps != null) {
		files.push(await localDepsFile(options.localDeps))
	}

	const allPaths = files.map(f =>f.path)
	allPaths.push(GitAttributes.default.path)
	allPaths.sort()
	if (new Set(allPaths).size != allPaths.length) {
		throw new Error(`Duplicate path in ${JSON.stringify(allPaths)}`)
	}

	const attributesFile = new GitAttributes(options.gitattributesExtra || []).derive(allPaths)
	
	const fs = fsOverride || DenoFS
	const fsUtil = FSUtil(fs)
	let previousPaths: Array<string> = []
	try {
		const fileContents = await fs.readTextFile(attributesFile.path)
		previousPaths = generatedFromGitAttributes(fileContents)
	} catch (err) {
		if (fsUtil.isNotFound(err)) {
			console.warn(`Can't load state from ${attributesFile.path}; assuming this is the first file generation run`)
		} else {
			throw err
		}
	}
	
	const toRemove = previousPaths.filter(p => allPaths.indexOf(p) == -1)
	await Promise.all(toRemove.map(p => fsUtil.removeIfPresent(p)))

	// always write attributes file first, so that if anything fails we've
	// at least recorded all files
	await writeTo(fsUtil, attributesFile, true)
	for (let file of files) {
		await writeTo(fsUtil, file, false)
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
