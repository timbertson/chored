import { existsSync } from "./lib/fs.ts"

function notNull<T>(desc: string, v: T|undefined|null): T {
	if (v == null) {
		throw new Error(`Error: null ${desc}`)
	}
	return v
}

interface Code {
	tsLiteral: string
}

const Code = {
	env: (key: string): Code => {
		notNull(key, Deno.env.get(key))
		return { tsLiteral: `Deno.env.get(${JSON.stringify(key)}) as string` }
	},
	value: (v: any): Code => {
		return { tsLiteral: JSON.stringify(v) }
	}
}

interface DenonConfig {
	denoExe: string,
	taskRoot: string,
}

interface Entrypoint {
	module: string,
	fn: string,
}

function resolveEntrypoint(config: DenonConfig, main: Array<string>): Entrypoint {
	// NOTE: should maybe support relative paths one day?
	const expandLocal = (f: string) => `${config.taskRoot}/${f}.ts`
	const isURI = (f: string) => f.lastIndexOf("://") !== -1
	const isModule = (f: string) => isURI(f) || existsSync(expandLocal(f))
	const expand = (f: string) => isURI(f) ? f : expandLocal(f)

	if (main.length == 2) {
		// definitely filename + function
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
			if (!existsSync(module)) {
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

const lockPath = (p: string) => p + ".lock"

async function lockModule(config: DenonConfig, path: string): Promise<void> {
	// TODO do in parallel, collect output so it doesn't interleave
	const p = Deno.run({ cmd:
		[ config.denoExe, "cache", "--lock", lockPath(path), "--lock-write", import.meta.url, path ]
	})
	let status = await p.status()
	if(!status.success) {
		throw new Error(`deno cache failed: ${status.code}`)
	}
}

async function lock(config: DenonConfig, args: Array<string>) {
	const expandLocal = (f: string) => `${config.taskRoot}/${f}.ts`
	if (args.length > 0) {
		for (let mod of args) {
			let path = expandLocal(mod)
			console.log(`Locking: ${mod} -> ${lockPath(path)}`)
			await lockModule(config, path)
		}
	} else {
		const entries: Iterable<Deno.DirEntry> = Deno.readDirSync(config.taskRoot)
		for (let entry of entries) {
			let name = entry.name
			if (name.endsWith(".ts")) {
				let path = `${config.taskRoot}/${name}`
				console.log(`Locking: ${name} -> ${lockPath(path)}`)
				await lockModule(config, path)
			}
		}
	}
}
async function run(config: DenonConfig, main: Array<string>, opts: RunOpts) {
	let entrypoint = resolveEntrypoint(config, main)

	let indent = "\t\t\t\t"
	let optsCode = `{\n${indent}` + Object.entries(opts).map(([k,v]) => `${k}: ${v.tsLiteral}`).join(`,\n${indent}`) + `\n${indent}}`

	// TODO typecheck
	let tsLiteral = `
		import { ${entrypoint.fn} } from ${JSON.stringify(entrypoint.module)}
		export function run() {
			${entrypoint.fn}(${optsCode})
		}
	`
	// console.log(tsLiteral)
	let tempFile = await Deno.makeTempFile({ prefix: "denon_", suffix: ".ts" })
	let compiled;
	try {
		await Deno.writeTextFile(tempFile, tsLiteral)
		compiled = await import(tempFile);
	} finally {
		await Deno.remove(tempFile)
	}
	compiled.run()
}

async function main(config: DenonConfig, args: Array<string>) {
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
		let arg = args.shift()
		if (arg == null) {
			break
		}
		if (arg == 'lock') {
			action = 'lock'
		} else if (arg == '--string' || arg == '-s') {
			let key = shift()
			opts[key] = Code.value(shift())
		} else if (arg == '--env') {
			let key = shift()
			let envKey = shift()
			opts[key] = Code.env(envKey)
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
			lock(config, main)
			break
		default:
			throw new Error("unknown action")
	}
}

main({
	denoExe: notNull("$DENO", Deno.env.get("DENO")),
	taskRoot: notNull("$DENON_TASKS", Deno.env.get("DENON_TASKS")),
}, Deno.args.slice())
