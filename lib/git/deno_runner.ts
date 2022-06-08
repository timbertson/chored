import { CmdRunner } from './describe_impl.ts'
import { run, RunOpts, runOutput } from '../cmd.ts'
import { DenoFS } from '../fs/impl.ts'

export default function runner(opts: RunOpts): CmdRunner {
	return {
		run: async (cmd: string[]) => { await run(cmd, opts) },
		runOutput: (cmd: string[]) => runOutput(cmd, { ...opts, printCommand: false }),
		tryRunOutput: (cmd: string[]) => runOutput(cmd, { ...opts, allowFailure: true, printCommand: false }),
		exists: (path: string) => DenoFS.exists(path),
	}
}
