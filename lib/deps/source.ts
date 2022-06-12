import { GithubImport } from './github.ts'
import { DenoImport } from './deno.ts'

export interface BaseImport {
	version: string | null
	path: string
	spec: string | null
}

// used in tests
export interface TestImport extends BaseImport {
	prefix: string
}

export type AnyImport = GithubImport | DenoImport | TestImport
export type AnyImportSpec = ImportSpec<GithubImport> | ImportSpec<DenoImport> | ImportSpec<TestImport>
export type AnySource = Source<GithubImport> | Source<DenoImport> | Source<TestImport>

// used to explicitly specify a target for a given remote
export interface BumpSpec {
	sourceName: string,
	spec: string,
}

export function parseSpec(s: string): BumpSpec {
	const parts = s.split('#')
	if (parts.length === 2) {
		const [sourceName, spec] = parts
		return { sourceName, spec }
	}
	throw new Error(`Can't parse spec: ${s}`)
}

// a specific spec (e.g. github repo & branch)
export interface Spec<Import extends BaseImport> {
	identity: string,
	matchesSpec(spec: BumpSpec): boolean
	resolve(verbose: boolean): Promise<string | null>
	show(imp: Import): string
}

export interface ImportSpec<Import extends BaseImport> {
	import: Import,
	spec: Spec<Import>,
}

export type OverrideFn<Import extends BaseImport> = (imp: Import, matches: (imp: Import, s: BumpSpec) => boolean) => Import

export function makeOverrideFn<T extends BaseImport>(overrides: BumpSpec[]): OverrideFn<T> {
	return (imp: T, matches: (_: T, s: BumpSpec) => boolean) => {
		for (const override of overrides) {
			if (matches(imp, override)) {
				return { ...imp, spec: override.spec }
			}
		}
		return imp
	}
}

export interface Source<Import extends BaseImport> {
	// parse(s: string, overrides: BumpSpec[]): ImportSpec<Import> | null
	parse(s: string, override: OverrideFn<Import>): ImportSpec<Import> | null
}

export const ImportUtil = {
	addSpec(imp: { spec: string | null }, s: string): string {
		if (imp.spec) {
			return s + '#' + imp.spec
		} else {
			return s
		}
	},

	root<T extends BaseImport>(imp: T): T {
		return { ... imp, spec: null, path: ''}
	},
	
	globToRegexp(glob: string): RegExp {
		// from https://github.com/tc39/proposal-regex-escaping/blob/main/polyfill.js
		const escaped = glob.replace(/[\\^$*+?.()|[\]{}]/g, (ch => {
			if (ch === '*') {
				return '.*'
			} else {
				return '\\'+ch
			}
		}))
		return new RegExp('^' + escaped + '$')
	}
}

export type Updater<Import> = (imp: Import) => Import
