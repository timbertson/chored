import * as Render from '../lib/render/file.ts'
import { write } from '../lib/render/write.ts'

export function main(opts: {}) {
	const files = [
		new Render.JSONFile("example/generated.json", { generated: true }),
		new Render.YAMLFile("example/generated.yaml", { generated: true }),
	]
	console.log("FILES: ", files, files.map(f => f.serialize()))
	write({ files })
}
