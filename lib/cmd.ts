import { readLines } from "https://deno.land/std@0.133.0/io/buffer.ts"

import notNull from './notNull.ts'

export interface Stdio {
	inherit?: boolean,
	discard?: boolean,
	string?: boolean,
	pipeLines?: (line: string) => void,
	
	// TODO add includeStderr for merging the two
	discardStderr?: boolean,
}

export interface RunResult {
	output: string|null,
	status: Deno.ProcessStatus,
}

export interface RunOpts {
	showCommand?: boolean,
	allowFailure?: boolean,
	stdio?: Stdio,
}

type DenoStdio = "inherit" | "piped" | "null" | number
type OutputDest = { output: string|null }
type OutputAction = (output: OutputDest, p: Deno.Process) => Promise<void>
function noopAction(output: OutputDest, p: Deno.Process) {
	return Promise.resolve()
}

async function readAction(output: OutputDest, p: Deno.Process) {
	output.output = new TextDecoder().decode(await p.output()).replace(/\n$/, '')
}

function pipeAction(fn: (line: string) => void): OutputAction {
	return async function(output: OutputDest, p: Deno.Process) {
		for await (const line of readLines(notNull("stdout", p.stdout))) {
			fn(line)
		}
		p.stdout?.close()
	}
}

export async function run(cmd: Array<string>, opts?: RunOpts): Promise<RunResult> {
	const stdio = opts?.stdio || {}
	let stdout: DenoStdio = 'inherit'
	let stderr: DenoStdio = 'inherit'
	let action: OutputAction = noopAction
	if (stdio.discard) {
		stdout = 'null'
	} else if (stdio.inherit) {
		stdout = 'inherit'
	} else if (stdio.string) {
		stdout = 'piped'
		action = readAction
	} else if (stdio.pipeLines) {
		stdout = 'piped'
		action = pipeAction(stdio.pipeLines)
	}

	if (stdio.discardStderr) {
		stderr = 'null'
	}

	const runOpts = {
		cmd: cmd,
		stdout: stdout,
		stderr: stderr,
	}

	const p = Deno.run(runOpts)
	const ret: OutputDest = { output: null }
	await action(ret, p)
	const status = await p.status()
	p.close()
	if (!opts?.allowFailure && !status.success) {
		throw new Error(`Command \`${cmd[0]}\` failed with status ${status.code}`)
	}
	return { output: ret.output, status }
}

export async function runTest(cmd: Array<string>, opts?: RunOpts): Promise<boolean> {
	opts = opts || {}
	const p = await run(cmd, {
		...opts,
		allowFailure: true
	})
	return p.status.success
}

export async function runOutput(cmd: Array<string>, opts?: RunOpts): Promise<string> {
	opts = opts || {}
	const stdio = opts.stdio || {}
	const p = await run(cmd, {
		...opts,
		stdio: { ... stdio,
			string: true
		}
	})
	return notNull('process output', p.output)
}
