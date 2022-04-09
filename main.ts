import { FS, DenoFS } from './lib/fs/impl.ts'
import notNull from './lib/util/not_null.ts'

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

interface Config {
	denoExe: string,
	taskRoot: string,
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
				let entryModule = expandLocal(entry)
				throw new Error(`Couldn't find a typescript module for ${entry} (${entryModule}) or index (${module})`)
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

const lockPath = (config: Config) => `${config.taskRoot}/.lock.json`

async function lockModules(config: Config, paths: Array<string>): Promise<void> {
	console.log(`Locking ${paths.length} task modules -> ${lockPath(config)}`)
	const p = Deno.run({ cmd:
		[ config.denoExe, "cache", "--lock", lockPath(config), "--lock-write", import.meta.url, ...paths ]
	})
	let status = await p.status()
	if(!status.success) {
		throw new Error(`deno cache failed: ${status.code}`)
	}
}

async function lock(config: Config) {
	const entries: Iterable<Deno.DirEntry> = Deno.readDirSync(config.taskRoot)
	const modules = Array.from(entries).map(e => `${config.taskRoot}/${e.name}`).filter(p => p.endsWith(".ts"))
	await lockModules(config, modules)
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
	
	let action = 'run'
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
		if (arg == '--lock') {
			action = 'lock'
		} else if (arg == '--run') {
			action = 'run'
		} else if (arg == '--string' || arg == '-s') {
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
	
	switch (action) {
		case 'run':
			run(config, main, opts)
			break

		case 'lock':
			if (main.length > 0) {
				throw new Error("too many arguments")
			}
			lock(config)
			break

		default:
			throw new Error("unknown action")
	}
}

export function defaultConfig(): Config {
	return {
		denoExe: Deno.execPath(),
		taskRoot: Deno.cwd() + '/choredefs',
	}
}

if (import.meta.main) {
	main(defaultConfig(), Deno.args.slice())
}
