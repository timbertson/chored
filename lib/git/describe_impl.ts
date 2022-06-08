function describeCmd(ref: string): string[] {
	// So we don't trip on any tags which happen to begin with `v`, we require at least one digit
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

export interface CmdRunner {
	run(cmd: string[]): Promise<void>
	runOutput(cmd: string[]): Promise<string>
	tryRunOutput(cmd: string[]): Promise<string>
	exists(path: string): Promise<boolean>
}

// https://stackoverflow.com/questions/56477321/can-i-make-git-fetch-a-repository-tag-list-without-actually-pulling-the-commit-d
// The docs say this simple approach doesn't work, but.. the docs are wrong in our favour?
// https://lore.kernel.org/git/CAC-LLDiu9D7Ea-HaAsR4GO9PVGAeXOc8aRoebCFLgDKow=hPTQ@mail.gmail.com/T/
// TODO if this doesn't work, we can `ls-remote` to get tags, then `git merge-base --is-ancestor candidate HEAD.
// But remote tags might be huge, so we'll try and get away without that
export async function describeWithAutoDeepen(runner: CmdRunner, ref: string): Promise<DescribedVersion> {
	async function describe(): Promise<DescribedVersion> {
		const describeOutput = await runner.tryRunOutput(describeCmd(ref))
		// console.log("Git describe output: "+ describeOutput)
		return parseDescribe(describeOutput)
	}

	async function loop(tries: number): Promise<DescribedVersion> {
		const ret = await describe()
		if (ret.tag != null || tries < 1) {
			return ret
		} else {
			// on the last attempt, we do a full clone
			const cmd = tries == 1 ? ['git', 'fetch', '--unshallow', '--tags'] : ['git', 'fetch', '--deepen', '100']
			console.warn("Fetching more history ...")
			runner.run(cmd)
			return loop(tries - 1)
		}
	}

	if (await runner.exists(".git/shallow")) {
		console.warn("Shallow repository detected")
		return await loop(4)
	} else {
		return describe()
	}
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
