import { run, RunOpts, RunResult } from './cmd.ts'
import notNull from './util/not_null.ts'
import merge from './util/shallow_merge.ts'

export interface UncommittedOptions {
	gitDir?: string,
	includeUntracked?: boolean,
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

export async function uncommittedChanges(opts?: UncommittedOptions): Promise<string|null> {
	const runOpts: RunOpts = {
		printCommand: false,
		allowFailure: true,
		stdout: 'string',
		stderr: 'string',
		cwd: opts?.gitDir,
	}

	if (opts?.includeUntracked === true) {
		const listUntracked = await run(['git', 'ls-files', '--other', '--exclude-standard'], runOpts)
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
	const diff = await run(['git',
		'--no-pager',
		'diff',
		'--exit-code',
	].concat(args, [ 'HEAD' ]), runOpts)

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

export async function requireCleanAround<T>(opts: RequireCleanOptions, action: () => Promise<T>): Promise<T> {
	const desc = opts.description ?? 'action'
	await requireClean(merge(opts, { description: `before ${desc}` }))
	const result = await action()
	await requireClean(merge(opts, { description: `after ${desc}`}))
	return result
}
