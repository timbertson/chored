import { render, JSONFile, YAMLFile, ExecutableFile } from '../lib/render.ts'
import { wrapperScript, bootstrapText } from '../lib/render/bootstrap.ts'
import { workflow as ci } from './lib/ci.ts'
import { file as Dockerfile } from './docker.ts'

export default async function(_: {}): Promise<void> {
	await render([
		new JSONFile("example/generated.json", { generated: true }),
		new YAMLFile("example/generated.yaml", { generated: true }),
		new ExecutableFile("install.sh", bootstrapText()),
		new YAMLFile(".github/workflows/ci.yml", ci),
		Dockerfile,
	], {
		// for this repo, we pin main to the local version instead of the public version
		wrapperScript: wrapperScript({ mainModule: './lib/main.ts' }),
	})
}
