// a sample CI github workflow
import { chores } from '../../lib/github/step.ts'
import { ciWorkflow } from '../../lib/github/workflow.ts'

export const workflow = ciWorkflow(chores([
	{ name: 'precommit' }
]))
