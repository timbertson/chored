import { FS, DenoFS } from './lib/fs/impl.ts'
import notNull from './lib/util/not_null.ts'
import { Config, defaultConfig } from './lib/chored_config.ts'

interface Code {
	tsLiteral: string
}

const Code = {
	env: (key: string): Code => {
		notNull(Deno.env.get(key), key)
		return { tsLiteral: `Deno.env.get(${JSON.stringify(key)}) as string` }
	},
	value: (v: any): Code => {
		return { tsLiteral: JSON.stringify(v) }
	}
}

interface Entrypoint {
	module: string,
	fn: string,
}

export function resolveEntrypoint(config: Config, main: Array<string>, fsOverride?: FS): Entrypoint {
	const fs = fsOverride || DenoFS
	// NOTE: should maybe support relative paths one day?
	const expandLocal = (f: string) => `${config.taskRoot}/${f}.ts`
	const isURI = (f: string) => f.lastIndexOf("://") !== -1
	const isModule = (f: string) => isURI(f) || fs.existsSync(expandLocal(f))
	const expand = (f: string) => isURI(f) ? f : expandLocal(f)

	if (main.length == 2) {
		// definitely module + function
		return {
			module: expand(main[0]),
			fn: main[1]
		}
	} else if (main.length == 1) {
		const entry = main[0]
		if (isModule(entry)) {
			return {
				module: expand(entry),
				fn: 'main'
			}
		} else {
			let module = expandLocal("index")
			if (!fs.existsSync(module)) {
				throw new Error(`No such choredef: ${entry}`)
			}
			return { fn: entry, module }
		}
		// might be filename, might be function in implicit main (index.ts)
	} else {
		throw new Error(`invalid main: ${JSON.stringify(main)}`)
	}
}

interface RunOpts {
	[index: string]: Code
}

function isPromise(obj: any) {
	return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

export async function run(config: Config, main: Array<string>, opts: RunOpts) {
	let entrypoint = resolveEntrypoint(config, main)

	let indent = "\t\t\t\t"
	let optsCode = `{\n${indent}` + Object.entries(opts).map(([k,v]) => `${k}: ${v.tsLiteral}`).join(`,\n${indent}`) + `\n${indent}}`

	let tsLiteral = `
		import { ${entrypoint.fn} } from ${JSON.stringify(entrypoint.module)}
		export function run() {
			${entrypoint.fn}(${optsCode})
		}
	`
	// console.log(tsLiteral)
	let tempFile = await Deno.makeTempFile({ prefix: "chored_", suffix: ".ts" })
	let compiled;
	try {
		await Deno.writeTextFile(tempFile, tsLiteral)
		compiled = await import('file://' + tempFile);
	} finally {
		await Deno.remove(tempFile)
	}
	const result = compiled.run()
	if (isPromise(result)) {
		await result
	}
}

const bools: { [index: string]: boolean } = { true: true, false: false }

async function main(config: Config, args: Array<string>) {
	let shift = () => {
		let ret = args.shift()
		if (ret == null) {
			throw new Error("too few arguments")
		}
		return ret
	}
	
	let main = []
	let opts: { [index: string]: Code } = {}
	while(true) {
		// TODO: more terse arg parsing:
		// `--foo bar` and `--foo=bar` short for `-s foo bar`
		// `--foo` short for `-b foo true' (when the next arg starts with `-` or there is none)
		// `--no-foo` short for `-b foo false'

		let arg = args.shift()
		if (arg == null) {
			break
		}
		// TODO turn standard actions into implicit choredefs.
		// Maybe even use explicit test of `index` to fallback on missing well-known chore
		if (arg == '--string' || arg == '-s') {
			let key = shift()
			opts[key] = Code.value(shift())
		} else if (arg == '--bool' || arg == '-b') {
			let key = shift()
			const value = shift()
			const bool = notNull(bools[value], `boolean(${value})`)
			opts[key] = Code.value(bool)
		} else if (arg == '--env') {
			let key = shift()
			let envKey = shift()
			opts[key] = Code.env(envKey)
		} else if (arg === '--' || arg === '-') {
			// pass remaining args
			opts['args'] = Code.value(args)
			break
		} else {
			main.push(arg)
			// TODO: can we get some doctext when there is a main set and --help passed?
			// throw new Error(`Unknown argument: ${arg}`)
		}
	}
	
	run(config, main, opts)
}

if (import.meta.main) {
	main(defaultConfig, Deno.args.slice())
}
