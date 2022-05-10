import withTempFile from '../fs/with_temp_file.ts'
import { notNull } from '../util/object.ts'
import { partition, equalArrays, sort } from '../util/collection.ts'
import { Config } from './config.ts'
import { replaceSuffix, trimIndent } from '../util/string.ts'

export interface Code {
	tsLiteral: string
}

export const Code = {
	env: (key: string): Code => {
		notNull(Deno.env.get(key), '$' + key)
		return { tsLiteral: `Deno.env.get(${JSON.stringify(key)}) as string` }
	},
	value: (v: any): Code => {
		return { tsLiteral: JSON.stringify(v) }
	}
}

type Id = [string] | [string, string]

export interface Entrypoint {
	module: string,
	id: Id,
	fn: string,
	impl: Function,
	viaDefault: boolean,
}

interface EntrypointSource {
	scope: string | null, // used to skip loading entrypoints that can't match
	entrypoints(): Promise<Entrypoint[]>
}

const builtinChores = () => replaceSuffix(import.meta.url, 'main/entrypoint.ts', 'chore/builtins.ts')

function isFunction(fn: any): fn is Function {
	return typeof(fn) === 'function'
}

async function entrypointsFromModule(scope: string|null, module: string): Promise<Entrypoint[]> {
	const api = await import(module)

	const makeId: (_: string) => Id = scope === null ? x => [x] : x => [scope, x]
	function tasksOn(base: any, viaDefault: boolean): Entrypoint[] {
		return sort(Object.keys(base)).flatMap((key) => {
			// TODO check for number of arguments?
			const impl = base[key]
			return isFunction(impl) ? [{ id: makeId(key), module, fn: key, impl, viaDefault }] : []
		})
	}

	return tasksOn(api, false).concat(tasksOn(api.default ?? {}, true))
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

function makeScopeMatcher(scope: string|null): (_: string) => boolean {
	return scope === null ? _ => true : name => name === scope
}

async function listFilesIn(path: string): Promise<string[]> {
	const rv: string[] = []
	for await (const entry of Deno.readDir(path)) {
		if (entry.isFile) {
			rv.push(entry.name)
		}
	}
	return rv
}

function nonNullEntrypoint(main: string[], entrypoint: Entrypoint|null): Entrypoint {
	if (entrypoint !== null) {
		return entrypoint
	} else {
		throw new Error(`Chore ${JSON.stringify(main)} not found. Try ./chored --list`)
	}
}

function niceId(entrypoint: Entrypoint): string {
	return (entrypoint.fn === 'default') ? entrypoint.id[0] : entrypoint.id.join(' ')
}

export class Resolver {
	config: Config

	constructor(config: Config) {
		this.config = config
	}

	async run(main: Array<string>, opts: RunOpts): Promise<void> {
		let entrypoint = await this.resolveEntrypoint(main)
		return runResolved(nonNullEntrypoint(main, entrypoint), opts)
	}
	
// return known entrypoint source within scopes, in priority order.
	async *entrypointSources(restrictScope: string | null): AsyncIterable<EntrypointSource> {
		if (restrictScope !== null && restrictScope.indexOf('/') !== -1) {
			// assume file or URL and load directly
			const url = restrictScope.indexOf('://') === -1 ? `file://${Deno.cwd()}/${restrictScope}` : restrictScope
			yield { scope: restrictScope, entrypoints: () => entrypointsFromModule(restrictScope, url) }
		} else {
			const files = (await listFilesIn(this.config.taskRoot)).filter(f => f.endsWith('.ts'))

			const [ indexFiles, taskFiles ] = partition(files, f => f === 'index.ts')
			taskFiles.sort()
			const taskOfFilename = (f: string) => replaceSuffix(f, '.ts', '')

			const restrictFilename = restrictScope === null ? null : `${restrictScope}.ts`
			for (const filename of taskFiles) {
				if (restrictFilename !== null && filename !== restrictFilename) {
					continue
				}
				const fileScope = taskOfFilename(filename)
				yield {
					scope: fileScope,
					entrypoints: () => entrypointsFromModule(fileScope, `file://${this.config.taskRoot}/${filename}`)
				}
			}

			for (const filename of indexFiles) {
				yield {
					scope: null,
					entrypoints: () => entrypointsFromModule(null, `file://${this.config.taskRoot}/${filename}`)
				}
			}
			
			yield {
				scope: null,
				entrypoints: () => entrypointsFromModule(null, builtinChores())
			}
		}
	}

	async resolveEntrypoint(main: Array<string>): Promise<Entrypoint | null> {
		const restrictScope = main[0] ?? null
		const mainWithDefault = main.concat(['default'])

		for await (const source of this.entrypointSources(restrictScope)) {
			if (source.scope === null && main.length > 1) {
				// unscoped (index) modules only have 1 component, and we need 2
				continue
			}
			const isMain = (e: Entrypoint) =>
				equalArrays(e.id, e.id.length === main.length ? main : mainWithDefault)
			const entry = (await source.entrypoints()).find(isMain)
			if (entry != null) {
				return entry
			}
		}
		return null
	}

	async listEntrypoints(main: Array<string>) {
		const scope = main[0] ?? null
		const matchesScope = makeScopeMatcher(scope)
		const seen = new Set<string>()
		const log: Array<string | string[]> = ['']
		for await (const source of this.entrypointSources(scope)) {
			let entrypoints = await source.entrypoints()
			if (source.scope === null) {
				entrypoints = entrypoints.filter(e => matchesScope(e.fn) && !seen.has(e.fn))
				if (entrypoints.length > 0) {
					log.push(`\n[ from ${entrypoints[0].module} ]:`)
				}
			} else {
				if (!matchesScope(source.scope)) {
					continue
				}
				seen.add(source.scope)
			}

			for (const entrypoint of entrypoints) {
				if (source.scope === null) {
					if (seen.has(entrypoint.fn)) {
						continue
					} else {
						seen.add(entrypoint.fn)
					}
				}
				// only list `default` targets at the toplevel
				log.push(` - ${niceId(entrypoint)}`)
			}
		}
		console.log(log.join('\n'))
	}

	async printHelp(main: Array<string>) {
		if (main.length === 0) {
			console.log(trimIndent(`
				Usage: ./chored [MODULE] CHORE [OPTIONS]
				
				Options will be passed as a single argument to the given function:
				  --string key value / -s key value / --key=value
				  --bool flag true / --flag / --no-flag
				  --num key int / -n key int / -n=int
				  --env key ENVNAME / -e key ENVNAME
				  --json '{ ... }'
				  -- ARGS (passed as \`args\` string array)
			`))
		} else {
			const entrypoint = nonNullEntrypoint(main, await this.resolveEntrypoint(main))
			const help = (entrypoint.impl as any).help ?? "(implementation has no `help` attribute)"
			console.info(`\nsource: ${entrypoint.module}\nchore:  ${niceId(entrypoint)}\n\n${help}`)
		}
	}
}
