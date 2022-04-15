import { Step } from './schema.ts'

export interface CheckoutOptions {
	version?: string,
}

export function checkout(opts?: CheckoutOptions): Step {
	return {
		name: 'Checkout',
		uses: `actions/checkout@${opts?.version ?? 'v3'}`,
	}
}

export interface SetupStepOptions {
	version?: string,
}

export function setupStep(opts?: SetupStepOptions): Step {
	return {
		name: 'Setup chored',
		uses: `timbertson/chored-setup@${opts?.version ?? 'v1'}`,
	}
}

export type Expr = { expr: string }
export function expr(expr: string): Expr {
	return { expr }
}
export type Primitive = string | number | boolean
export type Value = Primitive | Expr

export interface ChoreStep {
	stepName?: string,
	name: string,
	module?: string | null,
	opts?: { [k: string]: Value | string[] }
	envOpts?: { [k: string]: string }
}

function encodeValue(v: Value): Primitive {
	if (v != null && typeof(v) === "object") {
		return `\${{ ${v.expr} }}`
	} else {
		return v
	}
}

export function chore(opts: ChoreStep): Step {
	const args: string[] = []
	for (const [k,v] of Object.entries(opts.envOpts ?? {})) {
		args.push('--env', k, v)
	}

	const optValues: { [index: string]: Primitive | string[] } = {}
	const env: { [index: string]: Primitive } = {}

	for (const [k, v] of Object.entries(opts.opts ?? {})) {
		if (Array.isArray(v)) {
			optValues[k] = v
		} else {
			optValues[k] = encodeValue(v)
		}
	}

	const hasOpts = Object.keys(optValues).length > 0
	if (hasOpts) {
		args.push('--json', '"$OPTS"')
		env['OPTS'] = JSON.stringify(optValues)
	}

	const main = [ opts.name ]
	if (opts?.module != null) {
		main.unshift(`'${opts.module}'`)
	}

	const argStr = args.length === 0 ? '' : (' ' + args.join(' '))

	const ret: Step = {
		name: opts.stepName ?? opts.name,
		run: `./chored ${main.join(' ')}${argStr}`,
	}

	if (Object.keys(env).length > 0) {
		ret.env = env
	}
	return ret
}


// multi-step functions

export interface SetupStepsOptions {
	checkout?: CheckoutOptions | boolean,
	setup?: SetupStepOptions | boolean,
	postSetup?: Step[],
}

export function setupSteps(opts?: SetupStepsOptions): Step[] {
	const steps: Step[] = []
	const o = opts ?? {}
	if (o.checkout !== false) {
		steps.push(checkout(o.checkout === true ? {} : o.checkout))
	}
	if (o.setup !== false) {
		steps.push(setupStep(o.setup === true ? {} : o.setup))
	}
	return steps.concat(o.postSetup ?? [])
}

// quirky NonEmptyList provided by json schema conversion
export function nonEmpty<T>(items: T[]): [T, ...T[]] {
	if (items.length === 0) {
		throw new Error("empty array")
	}
	return items as [T, ...T[]]
}

export function chores(chores: ChoreStep[], opts?: SetupStepsOptions): [Step, ...Step[]] {
	return nonEmpty(setupSteps(opts ?? {}).concat(
		chores.map(chore),
	))
}
