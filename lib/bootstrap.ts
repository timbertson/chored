// invoked directly by bootstrap script
import { DenoFS } from './fs/impl.ts'

const renderModule = import.meta.url.replace(/bootstrap.ts$/, 'render.ts')

const renderTask = `
import { render, wrapperScript, JSONFile, YAMLFile } from '${renderModule}#main'

export async function main(opts: {}) {
	render([
		// TODO add your own generated files
	])
}
`

const renderPath = 'choredefs/render.ts'
export async function install() {
	console.log(`Generating initial choredefs ...`)
	await DenoFS.mkdirp('choredefs')

	const writeIfMissing = async (p: string, contents: string) => {
		if (await DenoFS.exists(p)) {
			console.warn(`WARN: path already exists, not overwriting: ${p}`)
		} else {
			await DenoFS.writeTextFile(p, contents)
		}
	}
	
	await writeIfMissing(renderPath, renderTask)

	const render = await import(`file://${Deno.cwd()}/${renderPath}`)
	console.log("Running render task ...")
	await render.main({})
}

if (import.meta.main) {
	install()
}
