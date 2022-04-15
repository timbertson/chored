import { Workflow, Step, Job } from './schema.ts'
import { nonEmpty } from './step.ts'

export function pullRequestAndBranches(...branches: string[]) {
	return {
		push: { branches },
		pull_request: {}
	}
}

export const mainBranches = ['main', 'master']
export const pullRequestAndCI = pullRequestAndBranches(...mainBranches)

export interface CIWorkflowOptions {
	branches?: string[],
	jobName?: string,
	name?: string,
}

export function ciWorkflow(steps: Step[], opts?: CIWorkflowOptions): Workflow {
	const jobs: { [k: string]: Job } = {}
	jobs[opts?.jobName ?? 'CI'] = {
		'runs-on': 'ubuntu-latest',
		steps: nonEmpty(steps),
	}
	return { on: pullRequestAndBranches(... (opts?.branches ?? mainBranches)), jobs }
}
