import { readLines } from "https://deno.land/std@0.133.0/io/buffer.ts"

import { notNull } from './util/object.ts'

export type Stdio = 'inherit' | 'discard' | 'string' | 'printOnError' | ((line: string) => void)
export type Stdin = 'inherit' | 'discard' | { contents: string }

export interface RunResult {
	status: Deno.ProcessStatus,
	output: string|null,
	errOutput: string|null,
}

export interface RunOpts {
	printCommand?: boolean,
	allowFailure?: boolean,
	stdin?: Stdin,
	stdout?: Stdio,
	stderr?: Stdio,
	cwd?: string,
	fatal?: boolean,
	env?: { [index: string]: string },
}

type DenoStdio = "inherit" | "piped" | "null" | number
type OutputDest = { output: string|null }
type StdioStream = "stdout" | "stderr"
type OutputAction = (output: OutputDest, p: Deno.Process) => Promise<void>

type OutputConfiguration = {
	runOpt: DenoStdio,
	action: OutputAction,
}

function noopAction(output: OutputDest, p: Deno.Process) {
	return Promise.resolve()
}

function readAction(stream: StdioStream): OutputAction {
	return async function(output: OutputDest, p: Deno.Process) {
		const bytes = stream === 'stderr' ? p.stderrOutput() : p.output()
		output.output = new TextDecoder().decode(await bytes).replace(/\n$/, '')
	}
}

function writeAction(contents: string): OutputAction {
	return async function(_: OutputDest, p: Deno.Process) {
		const stdin = notNull(p.stdin, 'process stdin')
		stdin.write(new TextEncoder().encode(contents))
		stdin.close()
	}
}

function printOnErrorAction(stream: StdioStream): OutputAction {
	return async function(output: OutputDest, p: Deno.Process) {
		await readAction(stream)(output, p)
		if (!await (await p.status()).success) {
			console.warn(output.output)
		}
	}
}

function pipeAction(stream: StdioStream, fn: (line: string) => void): OutputAction {
	return async function(_: OutputDest, p: Deno.Process) {
		const s = notNull(p[stream])
		for await (const line of readLines(s)) {
			fn(line)
		}
		s.close()
	}
}

function parseStdio(stream: StdioStream | 'stdin', stdio: Stdio | Stdin | null): OutputConfiguration {
	const ret: OutputConfiguration = {
		runOpt: 'inherit',
		action: noopAction,
	}
	if (stdio === 'discard') {
		ret.runOpt = 'null'
	} else if (stdio === 'inherit') {
		ret.runOpt = 'inherit'
	} else if (stream === 'stdin') {
		if (typeof(stdio) === 'object' && stdio != null && Object.hasOwn(stdio, 'contents')) {
			ret.runOpt = 'piped'
			ret.action = writeAction(stdio.contents)
		}
	} else {
		if (typeof(stdio) === 'function') {
			ret.runOpt = 'piped'
			ret.action = pipeAction(stream, stdio)
		} else if (stdio === 'string') {
			ret.runOpt = 'piped'
			ret.action = readAction(stream)
		} else if (stdio === 'printOnError') {
			ret.runOpt = 'piped'
			ret.action = printOnErrorAction(stream)
		}
	}
	return ret
}

export async function run(cmd: Array<string>, opts?: RunOpts): Promise<RunResult> {
	if (opts?.printCommand !== false) {
		console.warn(' + ' + cmd.join(' '))
	}
	let stdin = parseStdio('stdin', opts?.stdin || null)
	let stdout = parseStdio('stdout', opts?.stdout || null)
	let stderr = parseStdio('stderr', opts?.stderr || null)

	const runOpts: Deno.RunOptions = {
		cmd: cmd,
		stdin: stdin.runOpt,
		stdout: stdout.runOpt,
		stderr: stderr.runOpt,
		cwd: opts?.cwd,
		env: opts?.env,
	}

	const p = Deno.run(runOpts)
	const stdoutBuf: OutputDest = { output: null }
	const stderrBuf: OutputDest = { output: null }
	await Promise.all([
		stdin.action({ output: null }, p),
		stdout.action(stdoutBuf, p),
		stderr.action(stderrBuf, p),
	])
	const status = await p.status()
	p.close()

	if (!opts?.allowFailure && !status.success) {
		if (opts?.fatal === true) {
			// terminate without stacktrace
			Deno.exit(status.code)
		}
		throw new Error(`Command \`${cmd[0]}\` failed with status ${status.code}`)
	}
	return { output: stdoutBuf.output, errOutput: stderrBuf.output, status }
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
	return notNull(p.output, 'process output')
}
