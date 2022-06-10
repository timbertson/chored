import { gray, red } from './fmt/colors.ts'
import { notNull } from './util/object.ts'
import { Config, defaultConfig } from './main/config.ts'
import { DenoFS } from './fs/impl.ts'

import { Resolver, Code } from './main/entrypoint.ts'

const bools: { [index: string]: boolean } = { true: true, false: false }

interface Options {
	action: 'run' | 'list' | 'help' | 'local'
	main: string[]
	opts: { [index: string]: Code }
}

function guessType(s: string): Code {
	if (s === 'true') {
		return Code.value(true)
	} else if (s === 'false') {
		return Code.value(false)
	} else if (s.match(/^-?\d+$/)) {
		return Code.value(parseInt(s, 10))
	} else {
		return Code.value(s)
	}
}

export function parseArgs(args: Array<string>): Options {
	let shift = () => {
		let ret = args.shift()
		if (ret == null) {
			throw new Error("too few arguments")
		}
		return ret
	}
	
	let main = []
	let opts: { [index: string]: Code } = {}
	let action: 'run' | 'list' | 'help' | 'local' = 'run'
	while(true) {
		let arg = args.shift()
		if (arg == null) {
			break
		}
		if (arg == '__local') {
			action = 'local'
		} else if (arg == '--string' || arg == '-s') {
			let key = shift()
			opts[key] = Code.value(shift())
		} else if (arg == '--bool' || arg == '-b') {
			let key = shift()
			const value = shift()
			const bool = notNull(bools[value], `boolean(${value})`)
			opts[key] = Code.value(bool)
		} else if (arg == '--num' || arg == '-n') {
			let key = shift()
			opts[key] = Code.value(parseInt(shift(), 10))
		} else if (arg == '--json' || arg == '-j') {
			for (const [k,v] of Object.entries(JSON.parse(shift()))) {
				opts[k] = Code.value(v)
			}
		} else if (arg == '--env' || arg == '-e') {
			let key = shift()
			let envKey = shift()
			opts[key] = Code.env(envKey)
		} else if (arg == '--list' || arg == '-l') {
			action = 'list'
		} else if (arg === '--help' || arg == '-h') {
			action = 'help'
		} else if (arg === '--' || arg === '-') {
			// pass remaining args
			opts['args'] = Code.value(args)
			break
		} else if (arg.startsWith('--')) {
			let argBody = arg.substring(2)
			// try terse parsing
			if (argBody.indexOf('=') !== -1) {
				const [key, value] = argBody.split('=', 2)
				opts[key] = guessType(value)
			} else {
				const nextArg = args[0]
				if (nextArg != null && !nextArg.startsWith('-')) {
					// next argument looks like a value, either no leading dash or a negative number
					opts[argBody] = guessType(shift())
				} else {
					// no following value, assume boolean flag
					const value: boolean = !(argBody.startsWith('no-'))
					const key = value ? argBody : argBody.substring(3)
					opts[key] = Code.value(value)
				}
			}
		} else {
			main.push(arg)
			// TODO: can we get some doctext when there is a main set and --help passed?
			// throw new Error(`Unknown argument: ${arg}`)
		}
	}

	return { action, main, opts }
}

export async function main(config: Config, args: Array<string>): Promise<void> {
	const { action, main, opts } = parseArgs(args)
	const resolver = new Resolver(config)
	if (action === 'list') {
		await resolver.listEntrypoints(main)
	} else if (action == 'help') {
		await resolver.printHelp(main)
	} else if (action == 'local') {
		// This is invoked from the `chored` bash script, it produces a trimmed import map
		const input = JSON.parse(await DenoFS.readTextFile(`${config.taskRoot}/local-deps.json`))
		const imports: { [k: string]: string } = input.imports
		const filtered: { [k: string]: string } = {}
		const cwd = Deno.cwd() + '/'

		for (const [url, path] of Object.entries(imports)) {
			if (await (DenoFS.exists(path))) {
				filtered[url] = cwd + path
			} else {
				console.warn(`[local] path omitted: ${path}`)
			}
		}
		input.imports = filtered
		console.log(JSON.stringify(input, null, 2))
	} else {
		try {
			await resolver.run(main, opts)
		} catch (e) {
			const dump = (e instanceof Error ? e.stack : null) ?? String(e)
			const msgPos = dump.indexOf(e.message)
			if (Deno.isatty(Deno.stderr.rid) && msgPos > -1) {
				const splitIdx = msgPos + e.message.length
				Deno.stderr.writeSync(new TextEncoder().encode(red(dump.substring(0, splitIdx))))
				console.error(gray(dump.substring(splitIdx)))
			} else {
				console.error(dump)
			}
			Deno.exit(1)
		}
	}
}

if (import.meta.main) {
	main(defaultConfig, Deno.args.slice())
}
