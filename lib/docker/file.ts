import { TextFile } from '../render/file.ts'
export * from './image.ts'
import { Image, ImageExt } from './image.ts'

export interface Step {
	rawStep: string,
}
export const Step = {
	raw: (rawStep: string): Step => ({ rawStep }),
	directive: (d: string, line: string): Step => ({ rawStep: `${d} ${line}` }),

	run: (cmd: string[]): Step => Step.directive('RUN', JSON.stringify(cmd)),

	runSh: (sh: string): Step => Step.directive('RUN', sh),

	cmd: (cmd: string[]): Step => Step.directive('CMD', JSON.stringify(cmd)),

	workdir: (path: string): Step => Step.directive('WORKDIR', path),

	user: (user: string): Step => Step.directive('USER', user),
	
	copy: (src: string, dest: string): Step => Step.directive('COPY', `${src} ${dest}`),

	copyTo: (src: string, prefix: string): Step => Step.directive('COPY', `${src} ${prefix}/${src}`),

	copyFrom: (image: ImageSource, src: string, dest: string): Step =>
		Step.directive('COPY', `--from=${ImageExt.showSource(image)} ${src} ${dest}`),
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
	
	push(step: Step): this {
		this.steps.push(step)
		return this
	}

	pushAll(steps: Step[]): this {
		this.steps = this.steps.concat(steps)
		return this
	}

	run(cmd: string[]): this { return this.push(Step.run(cmd)) }

	runSh(sh: string): this { return this.push(Step.runSh(sh)) }

	cmd(cmd: string[]): this { return this.push(Step.cmd(cmd)) }

	workdir(path: string): this { return this.push(Step.workdir(path)) }

	user(user: string): this { return this.push(Step.user(user)) }

	copy(src: string, dest: string): this { return this.push(Step.copy(src, dest)) }

	copyTo(src: string, prefix: string): this { return this.push(Step.copyTo(src, prefix)) }

	copyFrom(image: ImageSource, src: string, dest: string): this { return this.push(Step.copyFrom(image, src, dest)) }
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
