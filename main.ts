import { FS, DenoFS } from './lib/fs/impl.ts'
import notNull from './lib/util/not_null.ts'
import { Config, defaultConfig } from './lib/chored_config.ts'
import replaceSuffix from './lib/util/replace_suffix.ts'

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

const builtinChores = () => replaceSuffix(import.meta.url, 'main.ts', 'lib/chore/builtins.ts')

export async function resolveEntrypoint(config: Config, main: Array<string>, fsOverride?: FS): Promise<Entrypoint> {
	const fs = fsOverride || DenoFS
	const localPath = (f: string) => `${config.taskRoot}/${f}.ts`
	const isURI = (f: string) => f.lastIndexOf("://") !== -1
	const isModule = async (f: string) => isURI(f) || await fs.exists(localPath(f))
	const toURI = (f: string) => isURI(f) ? f : `file://${localPath(f)}`

	if (main.length == 2) {
		// definitely module + function
		let [module, fn] = main
		if (main[0] === '--builtin') {
			module = builtinChores()
		}
		return {
			module: toURI(module),
			fn,
		}
	} else if (main.length == 1) {
		const entry = main[0]
		
		// it's a filename:
		if (await isModule(entry)) {
			return {
				module: toURI(entry),
				fn: 'main',
			}
		} else {
			// might be filename, might be function in implicit main (index.ts)
			// let index = expandLocal("index")
			let moduleURI: string = builtinChores()
			if (await isModule('index')) {
				const indexURI = toURI('index')
				const indexAPI: { [index: string]: any } = await import(indexURI)
				if (entry in indexAPI) {
					moduleURI = indexURI
				}
			}
			return { fn: entry, module: moduleURI }
		}
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

export async function run(config: Config, main: Array<string>, opts: RunOpts): Promise<any> {
	let entrypoint = await resolveEntrypoint(config, main)
	return runResolved(entrypoint, opts)
}

export async function runResolved(entrypoint: Entrypoint, opts: RunOpts): Promise<any> {
	let indent = "\t\t\t\t"
	let optsCode = `{\n${indent}` + Object.entries(opts).map(([k,v]) => `${k}: ${v.tsLiteral}`).join(`,\n${indent}`) + `\n${indent}}`

	const tsLiteral = `
		import * as mod from ${JSON.stringify(entrypoint.module)}
		export function _run() {
			return mod['${entrypoint.fn}'](${optsCode})
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
	const result = compiled._run()
	return isPromise(result) ? await result : result
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
