// a sample CI github workflow
import { setupSteps, chore } from '../../lib/github/step.ts'
import { ciWorkflow } from '../../lib/github/workflow.ts'
import merge from '../../lib/util/shallow_merge.ts'

export const workflow = ciWorkflow(
	setupSteps().concat(
		chore({ name: 'precommit', opts: { requireClean: true } }),
		merge(
			chore({ stepName: 'PR specific tests', name: 'test', opts: { args: ['test/lib/github/run_env_prtest_only.ts'] } }),
			{ if: "github.event_name == 'pull_request'"}
		),
		merge(
			chore({ stepName: 'Push specific tests', name: 'test', opts: { args: ['test/lib/github/run_env_pushtest_only.ts'] } }),
			{ if: "github.event_name == 'push'"}
		)
	), {
		branches: ['main', 'ci-*']
	}
)
