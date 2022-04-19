// context available via runner environment.
// These assume github semantics, but it only cares about the
// contents of your env.
//
// https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
import { Event } from './schema.ts'

const e = Deno.env
function get(k: string) {
	return e.get(k) || null
}

export const refType = get('GITHUB_REF_TYPE') as null | 'branch' | 'tag'
export const event = get('GITHUB_EVENT_NAME') as null | Event

export const isPush = event === 'push'
export const isPullRequest = event === 'pull_request'

export interface Repository {
	owner: string,
	name: string,
}

export function parseRepository(full: string): Repository {
	const parts = full.split('/')
	if (parts.length !== 2) {
		throw new Error("Invalid github repository: "+full)
	}
	const [ owner, name ] = parts
	return { owner, name }
}

export const repository: Repository | null = (() => {
	const repo = get('GITHUB_REPOSITORY')
	return repo ? parseRepository(repo) : null
})()

export const triggerRefName = get('GITHUB_REF_NAME')
export const triggerCommitSHA = get('GITHUB_SHA')

export const isBranchPush = isPush && refType === 'branch'
export const isTagPush = isPush && refType === 'tag'
export const pushedBranch = isBranchPush ? triggerRefName : null
export const pushedTag = isTagPush ? triggerRefName : null

export const pullRequestBranch = get('GITHUB_HEAD_REF')
export const pullRequestTarget = get('GITHUB_BASE_REF')

export const isCI = get('CI') === 'true'

export const runId = get('GITHUB_RUN_ID')
