import { Config, defaultConfig } from './main/config.ts'
import { run } from './cmd.ts'
import withTempFile from './fs/with_temp_file.ts'
import { replaceSuffix } from './util/string.ts'

export const lockPath = (config: Config = defaultConfig) => `${config.taskRoot}/lock.json`

const mainModule = replaceSuffix(import.meta.url, 'lib/lock.ts', 'main.ts')

async function lockModules(paths: Array<string>, config: Config = defaultConfig, lockPathOverride?: string): Promise<void> {
	const defaultLockPath = lockPath(config)
	if (!lockPathOverride) {
		console.log(`Locking ${paths.length} task modules -> ${defaultLockPath}`)
	}
	const activeLockPath = lockPathOverride || defaultLockPath
	await run(
		[ config.denoExe, "cache", "--lock", activeLockPath, "--lock-write", mainModule, ...paths ],
		{ printCommand: lockPathOverride == null })
}

async function choredefModules(config: Config = defaultConfig): Promise<Array<string>> {
	const entries: Iterable<Deno.DirEntry> = Deno.readDirSync(config.taskRoot)
	return Array.from(entries).map(e => `${config.taskRoot}/${e.name}`).filter(p => p.endsWith(".ts"))
}

export async function lock(config: Config = defaultConfig) {
	await lockModules(await choredefModules(config), config)
}

export interface Lock {
	[index: string]: string
}

export async function computeLock(config: Config = defaultConfig): Promise<Lock> {
	return withTempFile({ prefix: 'lock-', suffix: '.json' }, async (path: string) => {
		await lockModules(await choredefModules(config), config, path)
		const jsonStr = await Deno.readTextFile(path)
		return JSON.parse(jsonStr) as Lock
	})
}
