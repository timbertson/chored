// Pull request API
import { notNull } from '../util/object.ts'
import { Client as GQClient, Query } from '../graphql.ts'

export interface CreateOrUpdatePROptions extends FindPRParams {
	body: string,
	title: string,
	baseBranch: string,
}

export class GithubClient extends GQClient {
	async createOrUpdatePullRequest(opts: CreateOrUpdatePROptions): Promise<PullRequestIdentity> {
		const existing = await this.execute(findPullRequests, opts)
		let pr = existing.pullRequests[0]
		if (pr) {
			await this.execute(updatePullRequestContents, {
				...opts,
				id: pr.id
			})
			console.log(`Pull request updated: ${pr.url}`)

		} else {
			pr = await this.execute(createPullRequest, {
				...opts,
				repositoryId: existing.repositoryId
			})
			console.log(`Pull request created: ${pr.url}`)

		}
		return pr
	}
}

export function Client(token: string): GithubClient {
	return new GithubClient('https://api.github.com/graphql', {
		headers: {
			Authorization: `bearer ${token}`
		}
	})
}

export function defaultClient(): GithubClient {
	return Client(notNull(Deno.env.get('GITHUB_TOKEN'), '$GITHUB_TOKEN'))
}

function ignore(_: any): void {}

export interface Identity {
	id: string
}

export interface FindRepositoryParams {
	owner: string,
	repo: string,
}

export interface FindPRParams extends FindRepositoryParams {
	branchName: string
}

export interface PullRequestIdentity extends Identity {
	number: number,
	url: string
}

export const findPullRequests: Query<FindPRParams, {
	repositoryId: string,
	pullRequests: PullRequestIdentity[],
}> = {
	queryText: `
		query findPR($owner: String!, $repo: String!, $branchName: String!) {
			repository(owner: $owner, name: $repo) {
				id
				pullRequests(
					headRefName: $branchName,
					states:[OPEN],
					first:1)
				{
					edges {
						node {
							id
							number
							url
						}
					}
				}
			}
		}
	`,
	extract: (obj: any) => ({
		repositoryId: obj.repository.id,
		pullRequests: obj.repository.pullRequests.edges.map((e: any) => e.node),
	})
}

export interface UpdatePRParams {
	id: string,
	title: string,
	body: string,
}

export const updatePullRequestContents: Query<UpdatePRParams, void> = {
	extract: ignore,
	queryText: `
		mutation updatePR(
			$id: ID!,
			$title: String!
			$body: String!,
		) {
			updatePullRequest(input: {
				pullRequestId: $id,
				title: $title,
				body: $body
			}) {
				pullRequest { id }
			}
		}
	`
}

export interface CreatePRParams {
	repositoryId: string,
	branchName: string,
	baseBranch: string,
	title: string,
	body: string,
}

export const createPullRequest: Query<CreatePRParams, PullRequestIdentity> = {
	extract: (obj: any) => obj.createPullRequest.pullRequest,
	queryText: `
	mutation createPR(
		$branchName: String!,
		$baseBranch: String!,
		$body: String!,
		$title: String!,
		$repositoryId: ID!
	) {
		createPullRequest(input: {
			repositoryId: $repositoryId,
			headRefName: $branchName,
			baseRefName: $baseBranch,
			title: $title,
			body: $body
		}) {
			pullRequest {
				id
				number
				url
			}
		}
	}
	`
}


export const closePullRequest: Query<Identity, void> = {
	extract: ignore,
	queryText: `
		mutation closePR($id: ID!) {
			closePullRequest(input: { pullRequestId: $id }) {
				pullRequest { id }
			}
		}
	`,
}

export interface UserIdentity {
	login: string,
}

export const getAuthenticatedUser: Query<null, UserIdentity> = {
	extract: (obj: any) => ({ login: obj.viewer.login }),
	queryText: `
		query {
			viewer {
				login
			}
		}
	`
}

export const getDefaultBranchName: Query<FindRepositoryParams, string> = {
	extract: (obj: any) => obj.repository.defaultBranchRef.name as string,
	queryText: `
		query getDefaultBranchName($owner: String!, $repo: String!) {
			repository(owner: $owner, name: $repo) {
				defaultBranchRef {
					name
				}
			}
		}
	`
}

export async function test(_: {}) {
	console.log(await defaultClient().execute(getDefaultBranchName, { owner: 'timbertson', repo: 'sbt-strict-scope' }))
}
