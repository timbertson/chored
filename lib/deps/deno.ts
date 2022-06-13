// inspiration: https://deno.land/x/dmm@v2.1.0
// https://deno.land/x/dmm@v2.1.0/src/services/deno_service.ts
import { assertEquals } from "https://deno.land/std@0.143.0/testing/asserts.ts"

import { notNull } from "../util/object.ts";
import { BumpSpec, ImportSpec, ImportUtil, OverrideFn, Spec, Updater } from "./source.ts";

function u(s :string) {
	return encodeURIComponent(s)
}

const CDN = 'https://cdn.deno.land'

interface Versions {
	latest: string,
	versions: string[]
}

export async function listVersions(name: string): Promise<Versions> {
	const response = await fetch(`${CDN}/${u(name)}/meta/versions.json`)
	const json = await response.json()
	assertEquals(typeof(json.latest), 'string')
	assertEquals(Array.isArray(json.versions), true)
	for (const v of json.versions) {
		assertEquals(typeof(v), 'string')
	}
	return json
}

export interface DenoImport {
	prefix: string,
	path: string,
	version: string | null,
	spec: string | null,
	name: string,
}

export class DenoSpec implements Spec<DenoImport> {
	identity: string
	name: string
	spec: string | null

	constructor(imp: {spec: string | null, name: string }) {
		this.spec = imp.spec
		this.name = imp.name
		this.identity = DenoSpec.addSpec(imp, `deno:${this.name}`)
	}

	static show(imp: DenoImport): string {
		let nameAndVersion = imp.name
		if (imp.version != null) {
			nameAndVersion += `@${imp.version}`
		}
		return DenoSpec.addSpec(imp, `${imp.prefix}/${nameAndVersion}/${imp.path}`)
	}
	
	show(imp: DenoImport): string {
		return DenoSpec.show(imp)
	}

	private static addSpec(imp: { spec: string | null }, s: string): string {
		if (imp.spec) {
			return s + '#' + imp.spec
		} else {
			return s
		}
	}

	matchesSpec(spec: BumpSpec): boolean {
		return spec.sourceName === this.name
	}

	setSpec(spec: BumpSpec): void {
		this.spec = spec.spec
	}

	async resolve(verbose: boolean): Promise<string|null> {
		const meta = await listVersions(this.name)
		const spec = this.spec
		if (spec === null) {
			return meta.latest
		} else {
			const re = ImportUtil.globToRegexp(spec)
			return meta.versions.find(candidate => re.test(candidate)) ?? null
		}
	}

	root(imp: DenoImport): string {
		return DenoSpec.show({ ... imp, path: "", spec: null})
	}
}

export const DenoSource = {
	parse(url: string, override: OverrideFn<DenoImport>): ImportSpec<DenoImport> | null {
		// e.g. "https://deno.land/std@0.133.0/testing/asserts.ts"
		const dl = url.match(/^(https:\/\/deno\.land(?:\/x)?)\/([^/@]+)(?:@([^/]+))?\/([^#]*)(?:#(.+))?$/)
		if (dl !== null) {
			const [_match, prefix, name, version, path, spec] = dl
			const imp = override({
				prefix: notNull(prefix),
				name: notNull(name),
				version: version ?? null,
				spec: spec ?? null,
				path: notNull(path),
			}, (imp, spec) => new DenoSpec(imp).matchesSpec(spec))

			return { import: imp, spec: new DenoSpec(imp) }
		}
		
		return null
	}
}
