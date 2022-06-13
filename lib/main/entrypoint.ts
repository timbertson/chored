import withTempFile from '../fs/with_temp_file.ts'
import { notNull } from '../util/object.ts'
import { partition, equalArrays, sortByCmp } from '../util/collection.ts'
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
type Scope = [] | [string]

function assertId(parts: string[]): Id {
	if (parts.length === 1 || parts.length === 2) {
		return parts as Id
	} else {
		throw new Error(`Expected 1 or 2 components in Id, found ${parts.length}`)
	}
}

export interface Entrypoint {
	module: string,
	id: Id,
	symbol: string[],
	impl: Function,
}

interface EntrypointSource {
	scope: Scope, // used to skip loading entrypoints that can't match
	entrypoints(): Promise<Entrypoint[]>
}

const builtinChores = () => replaceSuffix(import.meta.url, 'main/entrypoint.ts', 'chore/builtins.ts')

function isChoredef(fn: any): fn is Function {
	return typeof(fn) === 'function' && (fn?.isChoredef ?? true === true)
}

function entrypointsFrom(module: string): (scope: Scope, symbol: string[], obj: any) => Entrypoint[] {
	return function scan(scope: string[], symbol: string[], obj: any): Entrypoint[] {
		function makeId(name: string): Id {
			return assertId(scope.concat(name))
		}

		const keys = Object.getOwnPropertyNames(obj)
		const entrypoints = keys.flatMap((key) => {
			const newPath = symbol.concat(key)
			const impl = obj[key]
			if (isChoredef(impl)) {
				return [{ id: makeId(key), module, symbol: newPath, impl }]
			} else {
				if (typeof(impl) === 'object') {
					if (key === 'default') {
						// merge default into the same scope
						return scan(scope, newPath, impl)
					} else if (scope.length == 0) {
						// recurse into this object
						return scan([key], newPath, impl)
					}
				}
				return []
			}
		})
		return sortByCmp(entrypoints, (a: string, b: string) => a.localeCompare(b), (e) => e.id.join('.'))
	}
}

export interface RunOpts {
	[index: string]: Code
}

function isPromise(obj: any) {
	return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

export async function runResolved(entrypoint: Entrypoint, opts: RunOpts): Promise<any> {
	const indent = "\t\t\t\t"
	const optsCode = `{\n${indent}` + Object.entries(opts).map(([k,v]) => `${k}: ${v.tsLiteral}`).join(`,\n${indent}`) + `\n${indent}}`

	const tsLiteral = `
		import * as mod from ${JSON.stringify(entrypoint.module)}
		export default function() {
			return mod${entrypoint.symbol.map(s => `['${s}']`).join('')}(${optsCode})
		}
	`
	const compiled = await withTempFile({ prefix: "chored_", suffix: ".ts" }, async (tempFile: string) => {
		// console.log(tsLiteral)
		await Deno.writeTextFile(tempFile, tsLiteral)
		return await import('file://' + tempFile)
	})
	const result = compiled.default()
	return isPromise(result) ? await result : result
}

function makeScopeMatcher(scope: Scope): (_: string[]) => boolean {
	return scope.length === 0 ? _ => true : candidate => {
		const commonLength = Math.min(candidate.length, scope.length)
		return equalArrays(candidate.slice(0, commonLength), scope.slice(0, commonLength))
	}
}

async function listFilesIn(path: string): Promise<string[]> {
	const rv: string[] = []

	async function isFileLink(entry: Deno.DirEntry): Promise<boolean> {
		if (entry.isSymlink) {
			try {
				return (await Deno.stat(`${path}/${entry.name}`)).isFile
			} catch (_) {
				// ignore
			}
		}
		return false
	}

	for await (const entry of Deno.readDir(path)) {
		if (entry.isFile || isFileLink(entry)) {
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
	// remove trailing `default`, unless that makes it empty
	let path: string[] = entrypoint.id
	if (path.length > 1 && path[path.length - 1] === 'default') {
		path = path.slice(0, -1)
	}
	return path.join(' ')
}

export class Resolver {
	config: Config

	constructor(config: Config) {
		this.config = config
	}

	async run(main: Array<string>, opts: RunOpts): Promise<any> {
		const entrypoint = await this.resolveEntrypoint(main)
		return runResolved(nonNullEntrypoint(main, entrypoint), opts)
	}
	
// return known entrypoint source within scopes, in priority order.
	async *entrypointSources(restrictScopeArray: Scope, opts?: { includeBuiltins: boolean }): AsyncIterable<EntrypointSource> {
		async function entrypointsFromModule(scope: Scope, url: string) {
			return entrypointsFrom(url)(scope, [], await import(url))
		}

		const restrictScope: string|null = restrictScopeArray[0] ?? null
		if (restrictScope !== null && restrictScope.indexOf('/') !== -1) {
			// assume file or URL and load directly
			const url = restrictScope.indexOf('://') === -1 ? `file://${Deno.cwd()}/${restrictScope}` : restrictScope
			yield {
				scope: restrictScopeArray,
				entrypoints: () => entrypointsFromModule([restrictScope], url),
			}
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
					scope: [fileScope],
					entrypoints: () => entrypointsFromModule([fileScope], `file://${this.config.taskRoot}/${filename}`)
				}
			}

			for (const filename of indexFiles) {
				yield {
					scope: [],
					entrypoints: () => entrypointsFromModule([], `file://${this.config.taskRoot}/${filename}`)
				}
			}
			
			if (opts?.includeBuiltins ?? true === true) {
				yield {
					scope: [],
					entrypoints: () => entrypointsFromModule([], builtinChores())
				}
			}
		}
	}

	async resolveEntrypoint(main: Array<string>): Promise<Entrypoint | null> {
		if (main.length === 0) {
			main = ['default']
		}
		const restrictScope = main.slice(0, 1) as Scope
		const mainWithDefault = main.concat(['default'])

		for await (const source of this.entrypointSources(restrictScope)) {
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
		const scope = main.slice(0, 1) as Scope
		const matchesScope = makeScopeMatcher(scope)
		const log: Array<string | string[]> = ['']
		const niceModule = (() => {
			const cwd = Deno.cwd() + '/'
			return (e: Entrypoint) => {
				let m = e.module
				m = m.replace(/^file:\/\//, '')
				if (m.startsWith(cwd)) {
					m = m.substring(cwd.length)
				}
				return m
			}
		})()
		for await (const source of this.entrypointSources(scope)) {
			if (!matchesScope(source.scope)) {
				continue
			}
			const entrypoints = (await source.entrypoints()).filter(e => matchesScope(e.id))
			if (entrypoints.length > 0) {
				// don't bother printing modules matching their filename
				if (!entrypoints.every(e => e.module.endsWith(`/${e.id[0]}.ts`))) {
					log.push(`\n   (${niceModule(entrypoints[0])})`)
				}
			}

			for (const entrypoint of entrypoints) {
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
