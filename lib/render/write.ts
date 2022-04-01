// Code for writing out a set of generated files
import { BaseFile, DerivedFile, GitAttributes } from './file.ts'

export type Options = {
	files: Array<BaseFile>,
	gitAttributes?: boolean | GitAttributes
}

export function write(options: Options) {
	const gitAttributes: GitAttributes|null = (options.gitAttributes == null || options.gitAttributes === true)
		? GitAttributes.default : (
		options.gitAttributes === false ? null : options.gitAttributes
	)
	const specialFiles: Array<DerivedFile> = []
	if (gitAttributes !== null) {
		specialFiles.push(gitAttributes)
	}

	const allPaths = specialFiles.map(f => f.path).concat(options.files.map(f =>f.path))
	allPaths.sort()
	const files: Array<BaseFile> = options.files.slice()
	for (let file of specialFiles) {
		files.push({
			...file,
			serialize: () => file.serialize(allPaths)
		})
	}
	
	for (let file of files) {
		console.log("###### ", file.path)
		console.log(file.serialize())
		console.log("====================\n\n\n\n")
	}
}
