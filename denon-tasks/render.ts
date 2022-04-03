import { render, JSONFile, YAMLFile } from '../lib/render/index.ts'

export async function main(_: {}) {
	return render([
		new JSONFile("example/generated.json", { generated: true }),
		new YAMLFile("example/generated.yaml", { generated: true }),
	])
}
