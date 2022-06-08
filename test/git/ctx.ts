import { CmdRunner } from '../../lib/git/describe_impl.ts'
import { Audit } from "../../lib/test/audit.ts";
import { equalArrays } from "../../lib/util/collection.ts";

export class Ctx {
	private responses: Array<[string[], string | boolean]> = []
	audit: Audit<string[]> = new Audit()
	runner: CmdRunner
	
	constructor() {
		const self = this
		function runOutput(cmd: string[], allowFailure: boolean) {
			const r = self.consumeResponse(cmd)
			if (r === false) {
				if (allowFailure) {
					return ''
				} else {
					throw new Error(`injected command failure: ${cmd.join(' ')}`)
				}
			} else if (r === true) {
				throw new Error(`Unexpected response type: ${r}`)
			}
			return r
		}
		const runner = this.runner = {
			run: async (cmd: string[]) => {
				const success = self.consumeBool(cmd, true)
				if (!success) {
					throw new Error("cmd failed")
				}
			},
			tryRunOutput: async (cmd: string[]) => runOutput(cmd, true),
			runOutput: async (cmd: string[]) => runOutput(cmd, false),
			exists: async (p: string) => {
				return self.consumeBool(['stat', p], false)
			}
		}
	}
	
	private consumeBool(cmd: string[], dfl: boolean|null = null): boolean {
		const r = this.consumeResponse(cmd, dfl)
		if (!(r === true || r === false)) {
			throw new Error(`Unexpected response type: ${r}`)
		}
		return r
	}

	private consumeResponse(cmd: string[], dfl: string|boolean|null = null): string|boolean {
		this.audit.record(cmd)
		const i = this.responses.findIndex(([prefix, _]) =>
			equalArrays(prefix, cmd.slice(0, prefix.length))
		)
		if (i === -1) {
			if (dfl != null) {
				return dfl
			} else {
				throw new Error(`Unexpected command: ${cmd.join(' ')}`)
			}
		}
		const response = this.responses[i][1]
		this.responses.splice(i, 1)
		return response
	}
	
	respond(prefix: string[], r: string|boolean): this {
		this.responses.push([prefix, r])
		return this
	}
}
