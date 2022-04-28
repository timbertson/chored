import { run } from "../cmd.ts";
import { image, Image, ImageExt } from "./image.ts"
import { Spec, MinimalSpec, MinimalStage, render } from "./file.ts"
export type { MinimalSpec, MinimalStage }

interface DockerfileLiteral {
	contents: string
}

export interface BuildOptions {
	dockerfile?: string | DockerfileLiteral,
	root?: string,
	push?: boolean,
}

export interface BuildInvocation extends BuildOptions {
	stage: string | null,
	cacheFrom?: Image[]
	tags?: Image[],
}

export function _buildCommand(opts: BuildInvocation = { stage: null }): string[] {
	const cmd = ['docker', 'build', '--file']

	const dockerfile = opts.dockerfile ?? 'Dockerfile'
	if (typeof(dockerfile) === 'object') {
		cmd.push('-')
	} else {
		cmd.push(dockerfile)
	}
	
	if (opts.stage) {
		cmd.push('--target', opts.stage)
	}
	for (const candidate of opts.cacheFrom ?? []) {
		cmd.push('--cache-from', ImageExt.show(candidate))
	}
	if (opts.tags && opts.tags.length > 0) {
		cmd.push('--tag', ImageExt.show(opts.tags[0]))
	}

	cmd.push('--build-arg', 'BUILDKIT_INLINE_CACHE=1')
	cmd.push(opts.root ?? '.')
	return cmd
}

export async function build(opts: BuildInvocation = { stage: null }) {
	const cmd = _buildCommand(opts)
	let stdin: undefined | DockerfileLiteral = undefined
	if (typeof(opts.dockerfile) === 'object') {
		stdin = opts.dockerfile
	}
	try {
		await run(cmd, { stdin })
	} catch(e) {
		if (stdin) {
			console.warn("Dockerfile build failed on literal:\n----\n"+stdin.contents+"\n----\n")
		}
		throw e
	}

	const tags = (opts.tags ?? [])
	for (const tag of tags.slice(1)) {
		// make secondary tags based on initial tag
		run(['docker', 'tag', ImageExt.show(tags[0]), ImageExt.show(tag)])
	}

	if (opts.push === true) {
		for (const tag of tags) {
			run(['docker', 'push', ImageExt.show(tag)])
		}
	}
}

export interface TagStrategy {
	cacheFrom: string[],
	tags: string[]
}

interface ConcreteTags {
	cacheFrom: Image[],
	tags: Image[]
}

export function _applyTag(tag: string, spec: MinimalSpec, stage: MinimalStage): Image {
	const suffix = stage.tagSuffix ?? `-${stage.name}`
	return image(spec.url, tag + suffix).raw
}

export function _applyTagStrategy(spec: MinimalSpec, strategy: TagStrategy, stage: MinimalStage): ConcreteTags {
	return {
		cacheFrom: (strategy.cacheFrom ?? []).map(base => _applyTag(base, spec, stage)),
		tags: (strategy.tags ?? []).map(base => _applyTag(base, spec, stage)),
	}
}

export async function buildAll(spec: MinimalSpec, opts: TagStrategy & BuildOptions) {
	// TODO pull prior tags if buildkit inline cache doesn't work right?
	for (const stage of spec.stages) {
		await build({
			...opts,
			..._applyTagStrategy(spec, opts, stage),
			stage: stage.name,
		})
	}
}

export async function buildAllFromSpec(spec: Spec, opts: TagStrategy & BuildOptions) {
	return buildAll(spec, {
		...opts,
		dockerfile: { contents: render(spec) }
	})
}
