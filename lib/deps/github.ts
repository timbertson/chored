import { run } from "../cmd.ts";
import { notNull } from "../util/object.ts";
import { Version } from "../version.ts";
import { BumpSpec, ImportSpec, Spec, Updater } from './source.ts'

export interface GithubImport {
	prefix: string,
	path: string,
	version: string,
	spec: string | null,
	owner: string,
	repo: string,
}

interface Ref {
	name: string,
	commit: string,
}

export class GithubSpec implements Spec<GithubImport> {
	identity: string
	repoName: string
	repoPath: string
	repoURL: string
	ref: string | null

	constructor(imp: {spec: string | null, owner: string, repo: string}) {
		this.ref = imp.spec
		this.repoName = imp.repo
		this.repoPath = `${imp.owner}/${imp.repo}`
		this.identity = GithubSpec.addSpec(imp, `github:${this.repoPath}`)

		// TODO: use https if there's known creds, otherwise ssh?
		// TODO: reuse deno's credentials system for transparently accessing private repos
		this.repoURL = `https://github.com/${imp.owner}/${imp.repo}.git`
	}

	static show(imp: GithubImport): string {
		return GithubSpec.addSpec(imp, `${imp.prefix}/${imp.owner}/${imp.repo}/${imp.version}/${imp.path}`)
	}

	private static addSpec(imp: { spec: string | null }, s: string): string {
		if (imp.spec) {
			return s + '#' + imp.spec
		} else {
			return s
		}
	}

	matchesSpec(spec: BumpSpec): boolean {
		return spec.sourceName === this.repoName || spec.sourceName === this.repoPath
	}

	setSpec(spec: BumpSpec): void {
		this.ref = spec.spec
	}

	async resolve(verbose: boolean): Promise<Updater<GithubImport>|null> {
		return this.resolveFrom(this.repoURL, verbose)
	}

	root(imp: GithubImport): string {
		return GithubSpec.show({ ... imp, path: "", spec: null})
	}

	async resolveFrom(repoURL: string, verbose: boolean): Promise<Updater<GithubImport>|null> {
		this.repoURL = repoURL // only used in testing
		const version = await this.resolveLatestVersion(verbose)
		if (version) {
			if (verbose) {
				console.log(`[version] ${version} ${this.identity}`)
			}
			return (imp: GithubImport) => GithubSpec.show({ ...imp, version })
		} else {
			return null
		}
	}

	private parseRef(line: string): Ref {
		let [commit, name] = line.split('\t', 2)
		
		// without refs/heads, refs/tags, etc
		const shortName = name.replace(/^refs\/[^/]+\//, '')

		if (name.startsWith('refs/tags/')) {
			// assume immutable; use the friendly name
			commit = shortName
		}
		return { commit, name: shortName }
	}

	private async resolveLatestVersion(verbose: boolean): Promise<string|null> {
		let refs: Array<Ref> = []
		const refFilter = this.ref || 'v*'
		const processLine = (line: string) => refs.push(this.parseRef(line))
		const cmd = ['git', 'ls-remote']
		const isWildcard = refFilter.lastIndexOf('*') >= 0

		if (isWildcard) {
			// grab only version-ish tags
			cmd.push('--tags')
		} else {
			// grab all refs, because we've got a specific ref
			cmd.push('--tags', '--heads')
		}
		cmd.push(this.repoURL, refFilter)

		await run(cmd, { stdout: processLine, printCommand: verbose })
		if (verbose) {
			console.log(`[refs]: ${refs.length} ${this.repoURL}`)
			for (const ref of refs) {
				console.log(`[ref]: ${ref.name} ${ref.commit}`)
			}
		}
		if (refs.length == 0) {
			console.warn(`WARN: No '${refFilter}' refs present in ${this.repoURL}`)
			return null
		}
		if (!isWildcard) {
			const matchingRefs = refs.filter(r => r.name === this.ref)
			if (matchingRefs.length == 0) {
				console.warn(`WARN: refs received from ${this.repoPath}, but none matched '${this.ref}'. Returned refs: ${JSON.stringify(refs)}`)
				return null
			} else if (matchingRefs.length > 1) {
				console.warn(`WARN: ${matchingRefs.length} matches for '${this.ref}' in ${this.repoPath}`)
			}
			return matchingRefs[0].commit
		}

		if (refs.length <= 1) {
			return refs[0]?.commit
		}

		// at least two refs
		const versions = (refs
			.flatMap((ref: Ref) => {
				const v = Version.parse(ref.name)
				return v === null ? [] : [{ v, commit: ref.commit }]
			})
		)
		if (verbose) {
			console.log(`[parsed versions]: ${versions.length} ${this.repoPath}`)
		}
		if (versions.length == 0) {
			console.warn(`WARN: no versions found in refs: ${JSON.stringify(refs.map(r => r.name))}`)
			return null
		}

		versions.sort((a, b) => Version.compare(a.v, b.v))
		return versions[versions.length-1].commit
	}
}

export const GithubSource = {
	parse(url: string): ImportSpec<GithubImport> | null {
		const gh = url.match(/^(https:\/\/raw\.githubusercontent\.com)\/([^/]+)\/([^/]+)\/([^/]+)\/([^#]*)(#(.+))?$/)
		if (gh !== null) {
			const [_match, prefix, owner, repo, version, path, _hash, spec] = gh
			const imp = {
				owner: notNull(owner),
				repo: notNull(repo),
				prefix: notNull(prefix),
				version: notNull(version),
				spec: spec ? spec : null,
				path: notNull(path),
			}
			return { import: imp, spec: new GithubSpec(imp) }
		}
		
		return null
	}
}
