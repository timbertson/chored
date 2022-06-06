export type { BumpOptions } from './bump_impl.ts'
import { BumpOptions, CmdRunner, Context } from './bump_impl.ts'
import { Version } from '../version.ts'
import { run, runOutput } from '../cmd.ts'
import { DenoFS } from '../fs/impl.ts'

export const defaultRunner: CmdRunner = {
	run: async (cmd: string[]) => { await run(cmd) },
	runOutput: (cmd: string[]) => runOutput(cmd),
	exists: (path: string) => DenoFS.exists(path),
}

export const defaultContext: Context = {
	headRef: 'HEAD',
	mergeTargetRef: 'HEAD',
}

export function bump(options: BumpOptions, ctx: Context = defaultContext): Promise<void> {
	new Engine(_Runner, ctx).
}
