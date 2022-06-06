export function describeCmd(ref: string): string[] {
	const matchFlags = [0,1,2,3,4,5,6,7,8,9].flatMap(n => ['--match', `v${n}*`])
	return (['git', 'describe', '--tags', '--first-parent' ]
		.concat(matchFlags)
		.concat(['--always', '--long', ref])
	)
}

export interface DescribedVersion {
	commit: string
	tag: string | null
	isExact: boolean
}

export function parseDescribe(output: string): DescribedVersion {
	const parts = output.split('-')
	if (parts.length == 1) {
		// just a git commit
		return { commit: output, tag: null, isExact: false }
	} else if (parts.length > 2) {
		// output is e.g. v1.3.0-3-gf32721e
		let tag = parts.slice(0, parts.length - 2).join('-')
		let depth = parts[parts.length - 2]
		return {
			commit: parts[parts.length - 1].slice(1),
			tag: tag,
			isExact: depth == '0',
		}
	} else {
		throw new Error("Unexpected `git describe` output: " + output)
	}
}
