import * as D from '../../../lib/docker/run.ts'
import { image } from '../../../lib/docker/image.ts'
import { assertEquals } from "../../common.ts";

const ubuntu = image('ubuntu')

Deno.test('docker run command', () => {
	assertEquals(D._command({ image: ubuntu }), [
		"docker",
		"run",
		"--rm",
		"--tty",
		"--interactive",
		"ubuntu",
	])
})
