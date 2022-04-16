// chored's own CI workflow
import { setupSteps, chore } from '../../lib/github/step.ts'
import { ciWorkflow } from '../../lib/github/workflow.ts'
import merge from '../../lib/util/shallow_merge.ts'
import tap from '../../lib/util/tap.ts'

export const workflow = ciWorkflow(
	setupSteps().concat(
		chore({ name: 'ci', opts: { requireClean: true } }),
		merge(
			chore({ stepName: 'PR specific tests', name: 'test', opts: { args: ['integration/github/pull_request_event'] } }),
			{ if: "github.event_name == 'pull_request'"}
		),
		merge(
			chore({ stepName: 'Push specific tests', name: 'test', opts: { args: ['integration/github/push_event'] } }),
			{ if: "github.event_name == 'push'"}
		),
		tap(
			chore({ stepName: 'Integration tests (Github API)', name: 'test', opts: { args: ['integration/github/authenticated'] } }),
			(step: any) => step.env.GITHUB_TOKEN = '${{ secrets.github_token }}'
		)
	), {
		branches: ['main', 'ci-*']
	}
)
