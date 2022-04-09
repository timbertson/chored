// invoked directly by bootstrap script
import { DenoFS } from './fs/impl.ts'

const renderModule = import.meta.url.replace(/bootstrap.ts$/, 'render.ts')

const renderTask = `
import { render, wrapperScript, JSONFile, YAMLFile } from '${renderModule}'

export async function main(opts: {}) {
	render([
		// TODO add your own generated files
	])
}
`

const installPath = 'choredefs/render.ts'
export async function install() {
	if (DenoFS.existsSync(installPath)) {
		throw new Error(`path already exists, not overwriting: ${installPath}`)
	}

	console.log(`generating initial ${installPath}`)
	await DenoFS.mkdirp('choredefs')
	await DenoFS.writeTextFile(installPath, renderTask)
	const render = await import(Deno.cwd() + '/choredefs/render.ts')
	console.log("Running initial render task ...")
	await render.main({})
}

if (import.meta.main) {
	install()
}
