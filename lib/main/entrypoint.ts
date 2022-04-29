import { FS, DenoFS } from '../fs/impl.ts'
import withTempFile from '../fs/with_temp_file.ts'
import { notNull } from '../util/object.ts'
import { dedupe } from '../util/collection.ts'
import { Config } from './config.ts'
import { replaceSuffix } from '../util/string.ts'

export interface Code {
	tsLiteral: string
}

export const Code = {
	env: (key: string): Code => {
		notNull(Deno.env.get(key), key)
		return { tsLiteral: `Deno.env.get(${JSON.stringify(key)}) as string` }
	},
	value: (v: any): Code => {
		return { tsLiteral: JSON.stringify(v) }
	}
}

export interface Entrypoint {
	module: string,
	fn: string,
	impl: Function,
	viaDefault: boolean,
}

export interface NoSuchEntrypoint {
	candidates: string[],
}

export function isEntrypointFound(candidate: Entrypoint | NoSuchEntrypoint): candidate is Entrypoint {
	return (candidate as Entrypoint).module !== undefined
}

const builtinChores = () => replaceSuffix(import.meta.url, 'main/entrypoint.ts', 'chore/builtins.ts')

async function resolveEntrypointSymbol(module: string, fn: string, chainError?: NoSuchEntrypoint): Promise<Entrypoint | NoSuchEntrypoint> {
	const api = await import(module)
	const isFunctionOn = (base: any) => (symbol: string) => typeof(base[symbol]) === 'function'
	let impl: Function | undefined = api[fn]
	let viaDefault = false
	if (typeof(impl) === 'function') {
		return { module, fn, impl, viaDefault }
	} else if (Object.hasOwn(api, 'default')) {
		impl = api.default[fn]
		viaDefault = true
		if (typeof(impl) === 'function') {
			return { module, fn, impl, viaDefault }
		}
	}

	let allExports = Object.keys(api).filter(isFunctionOn(api))
	if (viaDefault) {
		allExports = allExports.concat(
			Object.keys(api.default).filter(isFunctionOn(api.default))
		)
	}
	
	const thisError = [ `${module} symbol '${fn}', found ${JSON.stringify(dedupe(allExports))}` ]
	const allCandidates = chainError ? chainError.candidates.concat(thisError) : thisError
	return { candidates: allCandidates }
}

export async function resolveEntrypoint(config: Config, main: Array<string>, fsOverride?: FS): Promise<Entrypoint | NoSuchEntrypoint> {
	const fs = fsOverride || DenoFS
	const absolute = (f: string) => f.startsWith('/') ? f : `${Deno.cwd()}/${f}`
	const hasSlash = (f: string) => f.indexOf("/") !== -1
	const fsPath = (f: string) => hasSlash(f) ? absolute(f) : `${config.taskRoot}/${f}.ts`
	const isURI = (f: string) => f.lastIndexOf("://") !== -1
	const isModule = async (f: string) => hasSlash(f) || await fs.exists(fsPath(f))
	const toURI = (f: string) => isURI(f) ? f : `file://${fsPath(f)}`
	
	if (main.length == 0) {
		main = ['default']
	}
	
	if (main.length == 2) {
		// definitely module + function
		let [module, fn] = main
		if (main[0] === '--builtin') {
			module = builtinChores()
		}
		return await resolveEntrypointSymbol(toURI(module), fn)
	} else if (main.length == 1) {
		const entry = main[0]
		
		// it's a filename:
		if (await isModule(entry)) {
			return await resolveEntrypointSymbol(toURI(entry), 'default')
		} else {
			// first, try index:
			let chainError: NoSuchEntrypoint | undefined
			if (await isModule('index')) {
				const fromIndex: Entrypoint | NoSuchEntrypoint = await resolveEntrypointSymbol(toURI('index'), entry)
				if (isEntrypointFound(fromIndex)) {
					return fromIndex
				} else {
					chainError = fromIndex
				}
			}
			
			// if no luck, try builtin chores
			let builtins: string = builtinChores()
			return await resolveEntrypointSymbol(builtins, entry, chainError)
		}
	} else {
		throw new Error(`invalid main: ${JSON.stringify(main)}`)
	}
}

export interface RunOpts {
	[index: string]: Code
}

function isPromise(obj: any) {
	return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

export async function runResolved(entrypoint: Entrypoint, opts: RunOpts): Promise<any> {
	let indent = "\t\t\t\t"
	let optsCode = `{\n${indent}` + Object.entries(opts).map(([k,v]) => `${k}: ${v.tsLiteral}`).join(`,\n${indent}`) + `\n${indent}}`

	const tsLiteral = `
		import ${entrypoint.viaDefault ? 'mod' : '* as mod'} from ${JSON.stringify(entrypoint.module)}
		export default function() {
			return mod['${entrypoint.fn}'](${optsCode})
		}
	`
	const compiled = await withTempFile({ prefix: "chored_", suffix: ".ts" }, async (tempFile: string) => {
		await Deno.writeTextFile(tempFile, tsLiteral)
		return await import('file://' + tempFile)
	})
	const result = compiled.default()
	return isPromise(result) ? await result : result
}
