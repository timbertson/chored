// invoked directly by bootstrap script
import { DenoFS } from './fs/impl.ts'

const renderModule = import.meta.url.replace(/bootstrap.ts$/, 'render.ts')
const choreIndex = import.meta.url.replace(/lib\/bootstrap.ts$/, 'chores/index.ts')

const renderTask = `
import { render, wrapperScript, JSONFile, YAMLFile } from '${renderModule}'

export async function main(opts: {}) {
	render([
		// TODO add your own generated files
	])
}
`

const index = `
// You can add your own functions in this module or create them as separate files.
// To get you started, we'll include common tasks from chored (e.g. \`bump\`).
export * from '${choreIndex}'
`

const renderPath = 'choredefs/render.ts'
const indexPath = 'choredefs/index.ts'
export async function install() {
	console.log(`Generating initial choredefs ...`)
	await DenoFS.mkdirp('choredefs')

	const writeIfMissing = async (p: string, contents: string) => {
		if (DenoFS.existsSync(p)) {
			console.warn(`WARN: path already exists, not overwriting: ${p}`)
		} else {
			console.warn(' - ' + p)
			await DenoFS.writeTextFile(p, contents)
		}
	}
	
	await writeIfMissing(renderPath, renderTask)
	await writeIfMissing(indexPath, index)

	const render = await import(Deno.cwd() + '/' + renderPath)
	console.log("Running render task ...")
	await render.main({})
}

if (import.meta.main) {
	install()
}
