export interface Config {
	denoExe: string,
	taskRoot: string,
}

export const defaultConfig: Config = {
	denoExe: Deno.execPath(),
	taskRoot: Deno.cwd() + '/choredefs',
}
