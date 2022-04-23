import { _applyTagStrategy, _buildCommand } from "../../../lib/docker/build.ts";
import { MinimalSpec } from "../../../lib/docker/file.ts";
import { assertEquals } from "../../common.ts";

const spec: MinimalSpec = {
	url: 'localhost/app',
	stages: [
		{ name: 'stage1', tagSuffix: '-builder' },
		{ name: 'stage2', tagSuffix: '' },
		{ name: 'stage2' },
	]
}

Deno.test('applyTagStrategy', () => {
	assertEquals(spec.stages.map (stage =>
		_applyTagStrategy(spec, { tags: [ 'latest' ], cacheFrom: ['previous'] }, stage)),
		[
			{
				cacheFrom: [
					{
						tag: "previous-builder",
						url: "localhost/app",
					},
				],
				tags: [
					{
						tag: "latest-builder",
						url: "localhost/app",
					},
				],
			},
			{
				cacheFrom: [
					{
						tag: "previous",
						url: "localhost/app",
					},
				],
				tags: [
					{
						tag: "latest",
						url: "localhost/app",
					},
				],
			},
			{
				cacheFrom: [
					{
						tag: "previous-stage2",
						url: "localhost/app",
					},
				],
				tags: [
					{
						tag: "latest-stage2",
						url: "localhost/app",
					},
				],
			},
		]
	)
})

Deno.test('buildCommand', () => {
	assertEquals(_buildCommand({ stage: 'builder' }), [
		"docker", "build",
		"--file", "Dockerfile",
		"--target", "builder",
		"--build-arg", "BUILDKIT_INLINE_CACHE=1",
		".",
	])

	assertEquals(_buildCommand({ stage: 'builder', dockerfile: { contents: 'from scratch' } }), [
		"docker", "build",
		"--file", "-",
		"--target", "builder",
		"--build-arg", "BUILDKIT_INLINE_CACHE=1",
		".",
	])
})
