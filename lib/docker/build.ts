import { run } from "../cmd.ts";
import { image, Image, ImageExt } from "./image.ts"
import { MinimalSpec, MinimalStage } from "./file.ts"
export type { MinimalSpec, MinimalStage }

export interface BuildOptions {
	dockerfile?: string,
	root?: string,
	push?: boolean,
}

export interface BuildInvocation extends BuildOptions {
	stage: string | null,
	cacheFrom?: Image[]
	tags?: Image[],
}

export function _buildCommand(opts: BuildInvocation = { stage: null }): string[] {
	const cmd = ['docker', 'build', '-f', opts.dockerfile ?? 'Dockerfile']
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
	await run(cmd)

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

export function _applyTagStrategy(spec: MinimalSpec, strategy: TagStrategy, stage: MinimalStage): ConcreteTags {
	const suffix = stage.tagSuffix ?? `-${stage.name}`
	return {
		cacheFrom: (strategy.cacheFrom ?? []).map(base => image(spec.url, base + suffix).raw),
		tags: (strategy.tags ?? []).map(base => image(spec.url, base + suffix).raw),
	}
}

export async function buildAll(spec: MinimalSpec, opts: TagStrategy & BuildOptions) {
	// TODO pull prior tags if buildkit inline cache doesn't work right?
	for (const stage of spec.stages) {
		const concreteTags = _applyTagStrategy(spec, opts, stage)
		await build({
			...opts,
			...concreteTags,
			stage: stage.name,
		})
	}
}
