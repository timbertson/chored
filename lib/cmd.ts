import { TextLineStream } from "jsr:@std/streams@0.223.0/text-line-stream";

import { notNull } from './util/object.ts'

function readLines(stream: ReadableStream<Uint8Array<ArrayBuffer>>): ReadableStream<string> {
	return stream
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(new TextLineStream())
}

export type Stdio = 'inherit' | 'discard' | 'string' | 'printOnError' | ((line: string) => void)
export type Stdin = 'inherit' | 'discard' | { contents: string }

export interface RunResult {
	status: Deno.CommandStatus,
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

type DenoStdio = "inherit" | "piped" | "null"
type OutputDest = { output: string|null }
type StdioStream = "stdout" | "stderr"
type OutputAction = (output: OutputDest, p: Deno.ChildProcess) => Promise<void>

type OutputConfiguration = {
	runOpt: DenoStdio,
	action: OutputAction,
}

function noopAction(_dest: OutputDest, _proc: Deno.ChildProcess) {
	return Promise.resolve()
}

function readAction(stream: StdioStream): OutputAction {
	return async function(output: OutputDest, p: Deno.ChildProcess) {
		const string = await (stream === 'stderr' ? p.stderr : p.stdout).text()
		output.output = string.replace(/\n$/, '')
	}
}

function writeAction(contents: string): OutputAction {
	return function(_: OutputDest, p: Deno.ChildProcess) {
		const stdin = notNull(p.stdin, 'process stdin')
		const writer = stdin.getWriter()
		writer.write(new TextEncoder().encode(contents))
		writer.close()
		return Promise.resolve()
	}
}

function printOnErrorAction(stream: StdioStream): OutputAction {
	return async function(output: OutputDest, p: Deno.ChildProcess) {
		await readAction(stream)(output, p)
		if (!await (await p.status).success) {
			console.warn(output.output)
		}
	}
}

function pipeAction(stream: StdioStream, fn: (line: string) => void): OutputAction {
	return async function(_: OutputDest, p: Deno.ChildProcess) {
		const s = notNull(p[stream])
		for await (const line of readLines(s)) {
			fn(line)
		}
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
	const stdin = parseStdio('stdin', opts?.stdin || null)
	const stdout = parseStdio('stdout', opts?.stdout || null)
	const stderr = parseStdio('stderr', opts?.stderr || null)

	const execPath = notNull(cmd[0]);
	const runOpts: Deno.CommandOptions = {
		args: cmd.slice(1),
		stdin: stdin.runOpt,
		stdout: stdout.runOpt,
		stderr: stderr.runOpt,
		cwd: opts?.cwd,
		env: opts?.env,
	}

	const p = new Deno.Command(execPath, runOpts).spawn()
	const stdoutBuf: OutputDest = { output: null }
	const stderrBuf: OutputDest = { output: null }
	await Promise.all([
		stdin.action({ output: null }, p),
		stdout.action(stdoutBuf, p),
		stderr.action(stderrBuf, p),
	])
	const status = await p.status

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

export function runSilent(cmd: Array<string>, opts?: RunOpts): Promise<RunResult> {
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
