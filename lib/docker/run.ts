import { sort } from '../util/collection.ts'
import { Image, ImageExt } from './image.ts'
import { run as runCmd } from '../cmd.ts'

export interface BindMount {
	path: string,
	containerPath?: string,
}

export interface Volume {
	type: 'bind' | 'volume' | 'tmpfs'
	source?: string,
	destination?: string,
	readonly?: boolean,
}

function mountString(v: Volume): string {
	const pairs: string[] = []
	for (const key of sort(Object.keys(v))) {
		pairs.push(`${key}=${(v as any)[key]}`)
	}
	return pairs.join(',')
}

function bindVolume(v: BindMount): Volume {
	return {
		type: 'bind',
		source: v.path,
		destination: v.containerPath ?? v.path,
	}
}

export interface RunOptions {
	image: Image,
	tty?: boolean,
	cmd?: string[],
	volumes?: Volume[],
	workDir?: string,
	bindMounts?: BindMount[],
}

export async function run(opts: RunOptions) {
	await runCmd(_command(opts))
}

export function _command(opts: RunOptions): string[] {
	let cmd = ['docker', 'run', '--rm', '--interactive']
	if (opts.tty === true) {
		cmd.push('--tty')
	}

	const volumes = (opts.volumes ?? []).concat((opts.bindMounts ?? []).map(bindVolume))
	for (const volume of volumes) {
		cmd.push('--mount', mountString(volume))
	}
	if (opts.workDir) {
		cmd.push('--workdir', opts.workDir)
	}

	cmd.push(ImageExt.show(opts.image))
	if (opts.cmd && opts.cmd.length > 0) {
		cmd = cmd.concat(opts.cmd)
	}

	return cmd
}
