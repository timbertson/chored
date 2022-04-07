import { readLines } from "https://deno.land/std@0.133.0/io/buffer.ts"

import notNull from './notNull.ts'

export type Stdio = 'inherit' | 'discard' | 'string' | ((line: string) => void)

export interface RunResult {
	output: string|null,
	status: Deno.ProcessStatus,
}

export interface RunOpts {
	printCommand?: boolean,
	allowFailure?: boolean,
	stdout?: Stdio,
	stderr?: 'discard',
	cwd?: string,
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
	if (opts?.printCommand !== false) {
		console.warn(' + ' + cmd.join(' '))
	}
	let stdout: DenoStdio = 'inherit'
	let stderr: DenoStdio = 'inherit'
	let action: OutputAction = noopAction
	
	if (opts?.stdout) {
		const out = opts.stdout
		if (typeof(out) === 'function') {
			stdout = 'piped'
			action = pipeAction(out)
		} else if (out === 'discard') {
			stdout = 'null'
		} else if (out === 'inherit') {
			stdout = 'inherit'
		} else if (out === 'string') {
			stdout = 'piped'
			action = readAction
		}
	}

	if (opts?.stderr === 'discard') {
		stderr = 'null'
	}

	const runOpts = {
		cmd: cmd,
		stdout: stdout,
		stderr: stderr,
		cwd: opts?.cwd,
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
	const p = await run(cmd, {
		...opts,
		allowFailure: true
	})
	return p.status.success
}

export async function runSilent(cmd: Array<string>, opts?: RunOpts): Promise<RunResult> {
	return run(cmd, {
		...opts,
		printCommand: false,
		stdout: 'discard',
	})
}


export async function runOutput(cmd: Array<string>, opts?: RunOpts): Promise<string> {
	const p = await run(cmd, {
		...opts,
		stdout: 'string',
	})
	return notNull('process output', p.output)
}
