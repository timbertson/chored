import { Config, defaultConfig } from './chored_config.ts'

export const lockPath = (config: Config = defaultConfig) => `${config.taskRoot}/.lock.json`

async function lockModules(paths: Array<string>, config: Config = defaultConfig): Promise<void> {
	console.log(`Locking ${paths.length} task modules -> ${lockPath(config)}`)
	const p = Deno.run({ cmd:
		[ config.denoExe, "cache", "--lock", lockPath(config), "--lock-write", import.meta.url, ...paths ]
	})
	let status = await p.status()
	if(!status.success) {
		throw new Error(`deno cache failed: ${status.code}`)
	}
}

export async function lock(config: Config = defaultConfig) {
	const entries: Iterable<Deno.DirEntry> = Deno.readDirSync(config.taskRoot)
	const modules = Array.from(entries).map(e => `${config.taskRoot}/${e.name}`).filter(p => p.endsWith(".ts"))
	await lockModules(modules, config)
}

