// invoked directly by bootstrap script
import { DenoFS } from './fsImpl.ts'

const renderModule = import.meta.url.replace(/bootstrap.ts$/, 'render/index.ts')

const renderTask = `
import { render, wrapperScript, JSONFile, YAMLFile } from '${renderModule}'

export async function main(opts: {}) {
	render([
		// TODO add your own generated files
	])
}
`

const installPath = 'denon-tasks/render.ts'
export async function install() {
	if (DenoFS.existsSync(installPath)) {
		throw new Error(`path already exists, not overwriting: ${installPath}`)
	}

	console.log(`generating initial ${installPath}`)
	await DenoFS.mkdirp('denon-tasks')
	await DenoFS.writeTextFile(installPath, renderTask)
	const render = await import(Deno.cwd() + '/denon-tasks/render.ts')
	console.log("Running initial render task ...")
	await render.main({})
}

if (import.meta.main) {
	install()
}
