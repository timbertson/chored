import notNull from './notNull.ts'

export interface Stdio {
	inherit?: boolean,
	discard?: boolean,
	string?: boolean,
	pipeLines?: (line: string) => void,

	// for string and pipelines
	includeStderr?: boolean,
	discardStderr?: boolean,
}

export interface RunResult {
	output: string|null,
	exitCode: Number,
}

export interface RunOpts {
	showCommand?: boolean,
	allowFailure?: boolean,
	stdio?: Stdio,
}

export async function run(opts: RunOpts): Promise<RunResult> {
	throw new Error("TODO")
}

export async function runTest(opts: RunOpts): Promise<boolean> {
	throw new Error("TODO")
}

export async function runOutput(opts: RunOpts): Promise<string> {
	const stdio = opts.stdio || {}
	const p = await run({
		...opts,
		stdio: { ... stdio,
			string: true
		}
	})
	return notNull('process output', p.output)
}
