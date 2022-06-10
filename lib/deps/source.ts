import { GithubImport } from './github.ts'

// used in tests
export interface TestImport {
	url: string
}

export type AnyImport = GithubImport | TestImport
export type AnyImportSpec = ImportSpec<GithubImport> | ImportSpec<TestImport>
export type AnySource = Source<GithubImport>|Source<TestImport>

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
export interface Spec<Import> {
	identity: string,

	matchesSpec(spec: BumpSpec): boolean
	setSpec(spec: BumpSpec): void

	resolve(verbose: boolean): Promise<Updater<Import> | null>
	root(imp: Import): string
}

export interface ImportSpec<Import> {
	import: Import,
	spec: Spec<Import>,
}

export interface Source<Import> {
	parse(s: string): ImportSpec<Import> | null
}

export type Updater<Import> = (imp: Import) => string
