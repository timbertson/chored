function notNull<T>(desc: string, v: T|undefined|null): T {
	if (v == null) {
		throw new Error(`Error: null $desc`)
	}
	return v
}

async function main(args: Array<string>) {
	let shift = () => {
		let ret = args.shift()
		if (ret == null) {
			throw new Error("too few arguments")
		}
		return ret
	}
	
	let main = null
	let call = null
	let opts: { [index: string]: any } = {}
	while(true) {
		let arg = args.shift()
		if (arg == null) {
			break
		}
		if (arg === '--call') {
			call = shift()
		} else if (arg == '--string' || arg == '-s') {
			let key = shift()
			opts[key] = shift()
		} else if (arg == '--env') {
			let key = shift()
			let envKey = shift()
			opts[key] = notNull(envKey, Deno.env.get(envKey))
		} else if (main == null) {
			[main, call] = arg.split('#')
		} else {
			throw new Error(`Unknown argument: $arg`)
		}
	}
	
	main = notNull("main module", main)
	call = notNull("entrypoint", call)

	let tsLiteral = `
		import { ${call} } from ${main}
		${call}(${JSON.stringify(opts)})
	`
	Deno.emit("file:///tmp", {
		bundle: "classic"
	})

	let module = await import(main);
	console.log(Object.keys(module))
	console.log(`${main}#${call}(${JSON.stringify(opts)})`)
	let fn = notNull("main function", module[call])
	// TODO typecheck
	fn(opts)
}

main(Deno.args.slice())
