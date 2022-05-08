import { notNull } from './util/object.ts'
import { Config, defaultConfig } from './main/config.ts'

import { Resolver, Code } from './main/entrypoint.ts'

const bools: { [index: string]: boolean } = { true: true, false: false }

export async function main(config: Config, args: Array<string>): Promise<void> {
	let shift = () => {
		let ret = args.shift()
		if (ret == null) {
			throw new Error("too few arguments")
		}
		return ret
	}
	
	let main = []
	let opts: { [index: string]: Code } = {}
	let action: 'run' | 'list' = 'run'
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
	
	const resolver = new Resolver(config)
	if (action === 'list') {
		await resolver.listEntrypoints(main)
	} else {
		await resolver.run(main, opts)
	}
}

if (import.meta.main) {
	main(defaultConfig, Deno.args.slice())
}
