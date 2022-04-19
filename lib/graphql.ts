import { merge } from "./util/object.ts"

const trace = Deno.env.get('TRACE_GRAPHQL') == '1' ? (...args: any) => console.log(...args) : (...args: any) => { return }

export interface Query<Params, Result> {
	queryText: string,
	extract: (_: any) => Result,
}

export class Client {
	url: string
	private request: RequestInit

	constructor(url: string, request?: RequestInit) {
		this.url = url
		this.request = request || {}
	}

	async execute<Params, Result>(query: Query<Params,Result>, params: Params): Promise<Result> {
		trace(`query: ${query.queryText} (${this.url})`)
		const response = await fetch(this.url,
			{
				...this.request,
				headers: merge(this.request.headers ?? {}, {
					"Content-Type": "application/json",
				}),
				method: 'POST',
				body: JSON.stringify({
					query: query.queryText,
					variables: params
				})
			})
		if (!response.ok) {
			throw new Error(`graphQL query returned HTTP status ${response.status} (${response.statusText}):\n${query}`)
		}
		const json = await response.json()
		trace(' => JSON', json)
		if (json.errors) {
			throw new Error(`GraphQL query returned errors:\n${JSON.stringify(json.errors, null, 2)}`)
		}
		return query.extract(json.data)
	}
}
