import { TextFile } from '../render/file.ts'
export * from './image.ts'
import { Image, ImageExt } from './image.ts'

export interface Step {
	rawStep: string,
}
export const Step = {
	raw: (rawStep: string): Step => ({ rawStep })
}

// either a public image or another stage within the same dockerfile
export type ImageSource = Image | string

export interface MinimalSpec {
	stages: MinimalStage[]
	url: string,
}

export interface MinimalStage {
	name: string
	tagSuffix?: string,
}

export interface Stage extends MinimalStage {
	from: ImageSource,
	steps: Step[],
}

export class StageExt implements Stage {
	from: ImageSource
	tagSuffix?: string
	name: string
	steps: Step[] = []

	constructor(name: string, props: { from: ImageSource, tagSuffix?: string }) {
		this.from = props.from
		this.name = name
		this.steps = []
		this.tagSuffix = props.tagSuffix
	}
	
	rawStep(name: string, line: string): this {
		this.steps.push(Step.raw(`${name} ${line}`))
		return this
	}

	run(cmd: string[]): this { return this.rawStep('RUN', JSON.stringify(cmd)) }

	runSh(sh: string): this { return this.rawStep('RUN', sh) }

	cmd(cmd: string[]): this { return this.rawStep('CMD', JSON.stringify(cmd)) }

	workdir(path: string): this { return this.rawStep('WORKDIR', path) }

	user(user: string): this { return this.rawStep('USER', user) }
	

	copy(src: string, dest: string): this { return this.rawStep('COPY', `${src} ${dest}`) }

	copyTo(src: string, prefix: string): this {
		return this.rawStep('COPY', `${src} ${prefix}/${src}`)
	}

	copyFrom(image: ImageSource, src: string, dest: string): this {
		return this.rawStep('COPY', `--from=${ImageExt.showSource(image)} ${src} ${dest}`)
	}
}

export function stage(name: string, props: { from: ImageSource }): StageExt {
	return new StageExt(name, props)
}

function renderStage(t: Stage) {
	let fromLine = `FROM ${ImageExt.showSource(t.from)} as ${t.name}\n`
	return fromLine + t.steps.map(s => s.rawStep).join('\n')
}

export interface Spec {
	stages: Stage[]
	url: string,
}

export function render(spec: Spec): string {
	return spec.stages.map(renderStage).join('\n\n')
}

export class Dockerfile extends TextFile {
	spec: Spec

	constructor(spec: Spec, opts?: { path?: string }) {
		super(opts?.path ?? 'Dockerfile', render(spec))
		this.spec = spec
	}
}
