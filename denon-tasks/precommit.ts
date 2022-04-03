import * as render from './render.ts'
import * as test from './test.ts'

export async function main(opts: {}) {
	await Promise.all([
		test.main({}),
		render.main({}),
	])
}
