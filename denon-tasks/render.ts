import { render, JSONFile, YAMLFile, RawFile, ExecutableFile } from '../lib/render.ts'
import { wrapperScript, bootstrapText } from '../lib/render/denonBin.ts'

export async function main(_: {}): Promise<void> {
	return render([
		new JSONFile("example/generated.json", { generated: true }),
		new YAMLFile("example/generated.yaml", { generated: true }),
		new ExecutableFile("install.sh", bootstrapText()),
	], {
		// for this repo, we pin main to the local version instead of the public version
		wrapperScript: wrapperScript({ mainModule: './main.ts' })
	})
}
