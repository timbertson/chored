// a sample CI github workflow
import * as GH from '../../schemas/github_workflow.ts'

export const workflow: GH.GithubWorkflow = {
	on: {
		push: {
			branches: ['main' /*, 'ci' */],
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
					name: 'Cache',
					uses: 'timbertson/chored-init-action@main',
				},
				{
					name: "Test and generate",
					run: './chored precommit'
				}
			],
		}
	}
}
