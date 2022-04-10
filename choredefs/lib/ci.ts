// a sample CI github workflow
import * as GH from '../../schemas/github_workflow.ts'

export const workflow: GH.GithubWorkflow = {
	on: {
		push: {
			branches: ['main'],
		},
		pull_request: {}
	},
	jobs: {
		'ci': {
			'runs-on': 'ubuntu-latest',
			steps: [
				{
					uses: 'actions/checkout@v3',
				},
				{
					name: 'Cache deno',
					uses: 'actions/cache@v3',
					with: {
						path: '~/.cache/chored',
						key: "deno-${{ runner.os }}-${{ hashFiles('chored') }}",
					}
				},
				
				{
					name: 'Cache chore dependencies',
					uses: 'actions/cache@v3',
					with: {
						path: '~/.cache/deno',
						// TODO use lockfile instead, or maybe opt in to each?
						key: "choredef-${{ hashFiles(\'choredefs/**.ts\') }}",
					},
				},
				
				{
					name: "Test and generate",
					run: './chored precommit'
				}
			],
		}
	}
}
