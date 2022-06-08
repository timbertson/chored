import { run, RunOpts, runOutput, RunResult } from './cmd.ts'
import { notNull, merge } from './util/object.ts'
import { DescribedVersion as BaseDescribedVersion, describeWithAutoDeepen } from './git/describe_impl.ts'
import runner from './git/deno_runner.ts'
import { Version } from "./version.ts";
export interface DescribedVersion extends BaseDescribedVersion {
	version: Version | null
}

export interface Identity {
	name: string,
	email: string,
}

export const nobody: Identity = { name: 'nobody', email: 'nobody@localhost' }

export interface CommonOptions {
	gitDir?: string,
	identity?: Identity,
}

export interface UncommittedOptions extends CommonOptions {
	includeUntracked?: boolean,
	includeStaged?: boolean,
	colorDiff?: boolean,
}

export interface RequireCleanOptions extends UncommittedOptions {
	printDiff?: boolean,
	description?: string
}

function failUnexpectedStatus(result: RunResult): string {
	console.warn(result.errOutput)
	throw new Error(`git command failed with status ${result.status.code}`)
}

export function identityEnv(identity: Identity): { [k: string]: string } {
	return {
		GIT_AUTHOR_NAME: identity.name,
		GIT_AUTHOR_EMAIL: identity.email,
		GIT_COMITTER_NAME: identity.name,
		GIT_COMITTER_EMAIL: identity.email,
	}
}

function runOpts(common: CommonOptions): RunOpts {
	const opts: RunOpts = {
		printCommand: false,
		cwd: common?.gitDir,
	}
	if (common.identity) {
		opts.env = identityEnv(common.identity)
	}
	return opts
}

export async function uncommittedChanges(opts?: UncommittedOptions): Promise<string|null> {
	const activeRunOpts: RunOpts = {
		...runOpts(opts ?? {}),
		allowFailure: true,
		stdout: 'string',
		stderr: 'string',
	}
	if (opts?.includeUntracked !== false) {
		const listUntracked = await run(['git', 'ls-files', '--other', '--exclude-standard'], activeRunOpts)
		const untrackedFiles = notNull(listUntracked.output)
		if (!listUntracked.status.success) {
			return failUnexpectedStatus(listUntracked)
		}
		if (untrackedFiles.length > 0) {
			return untrackedFiles.replaceAll(/^/gm, ' - Untracked file: ')
		}
	}

	const args = []
	if (opts?.colorDiff !== false) {
		args.push('--color=always')
	}
	const cmd = ['git', '--no-pager', 'diff', '--exit-code' ]
	if (opts?.includeStaged !== false) {
		cmd.push('HEAD')
	}
	const diff = await run(cmd, activeRunOpts)

	if (diff.status.code === 0) {
		return null
	} else if (diff.status.code === 1) {
		return notNull(diff.output, '`git diff` output')
	} else {
		return failUnexpectedStatus(diff)
	}
}

export async function requireClean(opts?: RequireCleanOptions): Promise<void> {
	const diff = await uncommittedChanges(opts)
	if (diff !== null) {
		if (opts?.printDiff !== false) {
			console.warn(diff)
		}
		const suffix = opts?.description ? ` ${opts.description}` : ''
		throw new Error('ERROR: clean workspace required' + suffix)
	}
}

export async function requireCleanIf(condition: boolean, opts?: RequireCleanOptions): Promise<void> {
	return condition ? Promise.resolve() : requireClean(opts)
}

export async function requireCleanAround<T>(opts: RequireCleanOptions, action: () => Promise<T>): Promise<T> {
	const desc = opts.description ?? 'action'
	await requireClean(merge(opts, { description: `before ${desc}` }))
	const result = await action()
	await requireClean(merge(opts, { description: `after ${desc}`}))
	return result
}

export async function requireCleanAroundIf<T>(condition: boolean, opts: RequireCleanOptions, action: () => Promise<T>): Promise<T> {
	if (condition) {
		return await requireCleanAround(opts, action)
	} else {
		return await action()
	}
}

export async function branchName(options?: CommonOptions): Promise<string | null> {
	const output = (await runOutput(['git', 'branch', '--show-current'], runOpts(options ?? {}))).trim()
	return output === '' ? null : output
}

export interface CommitAllOptions extends CommonOptions {
	includeUntracked: boolean
	commitMessage: string,
}

export interface AmendAllOptions extends CommonOptions {
	includeUntracked: boolean
}

export async function addAll(options: CommonOptions = {}): Promise<void> {
	await run(['git', 'add', '.'], runOpts(options))
}

export async function commitAllChanges(options: CommitAllOptions): Promise<void> {
	if (options.includeUntracked) {
		await addAll(options)
	}
	await run(['git', 'commit', '--all', '--message', options.commitMessage], {
		...runOpts(options),
		printCommand: true
	})
}

export async function amendAllChanges(options: AmendAllOptions): Promise<void> {
	if (options.includeUntracked) {
		await addAll(options)
	}
	await run(['git', 'commit', '--all', '--amend', '--no-edit'], {
		...runOpts(options),
		printCommand: true
	})
}

export interface DescribeOptions extends CommonOptions {
	ref?: string
}
export async function describeVersion(opts: DescribeOptions): Promise<DescribedVersion> {
	const base = await describeWithAutoDeepen(runner(runOpts(opts)), opts.ref ?? 'HEAD')
	return { ...base, version: base.tag ? Version.parse(base.tag) : null }
}
