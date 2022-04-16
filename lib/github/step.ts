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

export interface Expr { expr: string }
export const expr = (expr: string): Expr => ({ expr })
export const secret = (name: string): Expr => expr('secrets.' + name)

export interface EnvVar { envName: string }
export const envVar = (envName: string): EnvVar => ({ envName })

export type Primitive = string | number | boolean
export type Value = Primitive | Expr
export type OptValue = Value | EnvVar | string[]

export interface ChoreStep {
	stepName?: string,
	name: string,
	module?: string | null,
	opts?: { [k: string]: OptValue }
}

export function encodeValue(v: Value): Primitive {
	if (v != null && typeof(v) === "object") {
		return `\${{ ${v.expr} }}`
	} else {
		return v
	}
}

export function chore(opts: ChoreStep): Step {
	const args: string[] = []
	const optValues: { [index: string]: Primitive | string[] } = {}

	for (const [k, v] of Object.entries(opts.opts ?? {})) {
		if (typeof(v) === 'object') {
			if (Array.isArray(v)) {
				optValues[k] = v
			} else if (Object.hasOwn(v ,'expr')) {
				optValues[k] = encodeValue(v as Expr)
			} else if (Object.hasOwn(v ,'envName')) {
				args.push('--env', k, (v as EnvVar).envName)
			} else {
				throw new Error(`Unkhandled OptValue: ${JSON.stringify(v)}`)
			}
		} else {
			optValues[k] = encodeValue(v)
		}
	}

	let env: { [index: string]: string } | null = null
	const hasOpts = Object.keys(optValues).length > 0
	if (hasOpts) {
		args.push('--json', '"$OPTS"')
		env = { OPTS: JSON.stringify(optValues) }
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

	if (env != null) {
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
