// context available via runner environment.
// These assume github semantics, but it only cares about the
// contents of your env.
import { Event } from './schema.ts'

const e = Deno.env
function get(k: string) {
	return e.get(k) || null
}

export const refType = get('GITHUB_REF_TYPE') as null | 'branch' | 'tag'
export const event = get('GITHUB_EVENT_NAME') as null | Event

export const isPush = event === 'push'
export const isPullRequest = event === 'pull_request'

const refName = get('GITHUB_REF_NAME')

export const isBranchPush = isPush && refType === 'branch'
export const isTagPush = isPush && refType === 'tag'
export const pushedBranch = isBranchPush ? refName : null
export const pushedTag = isTagPush ? refName : null

export const pullRequestBranch = get('GITHUB_HEAD_REF')
export const pullRequestTarget = get('GITHUB_BASE_REF')

export const isCI = get('CI') === 'true'
