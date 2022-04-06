import { render, JSONFile, YAMLFile } from '../lib/render/index.ts'
import { wrapperScript } from '../lib/render/denonBin.ts'

export async function main(_: {}): Promise<void> {
	return render([
		new JSONFile("example/generated.json", { generated: true }),
		new YAMLFile("example/generated.yaml", { generated: true }),
		wrapperScript
	])
}
