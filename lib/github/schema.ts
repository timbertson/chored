// mainly a reexport of the json-schema, but with extra copy-pastes for important types like Step
import { WorkingDirectory, Shell, ExpressionSyntax } from '../../schemas/github_workflow.ts'

export type {
	GithubWorkflow as Workflow,
	NormalJob as Job,
	Event
} from '../../schemas/github_workflow.ts'

export interface Step {
      id?: string;
      if?: string;
      name?: string;
      uses?: string;
      run?: string;
      "working-directory"?: WorkingDirectory;
      shell?: Shell;
      with?:
        | {
            [k: string]: string | number | boolean;
          }
        | string;
      env?:
        | {
            [k: string]: string | number | boolean;
          }
        | string;
      "continue-on-error"?: boolean | ExpressionSyntax;
      "timeout-minutes"?: number;
    }
