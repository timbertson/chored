import { write, JSONFile, YAMLFile } from '../lib/render/index.ts'

export async function main(_: {}) {
	return write({ files: [
		new JSONFile("example/generated.json", { generated: true }),
		new YAMLFile("example/generated.yaml", { generated: true }),
	]})
}
