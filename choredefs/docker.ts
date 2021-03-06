import { image, Dockerfile, stage } from '../lib/docker/file.ts'
import { standardBuild } from "../lib/github/docker.ts"

export const file = new Dockerfile({
	url: 'localhost/test',
	stages: [
		stage('builder', { from: image('ubuntu') }),
	]
}, {
	path: 'example/Dockerfile',
})

export default async function(_: {}) {
	await standardBuild(file.spec, { root: 'example', dockerfile: file.path })
}
