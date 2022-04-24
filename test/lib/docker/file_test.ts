import * as D from '../../../lib/docker/file.ts'
import { assertEquals } from "../../common.ts";

const ubuntu = D.image('ubuntu')

Deno.test('spec render', () => {
	const spec: D.Spec = {
		url: 'test',
		stages: [
			D.stage('builder', { from: ubuntu })
				.runSh('echo "test case" > /hello'),

			D.stage('runtime', { from: ubuntu })
				.copyFrom('builder', '/hello', '/hello')
				.cmd(['cat', '/hello'])
		]
	}

	assertEquals(D.render(spec),
	` FROM ubuntu as builder
		RUN echo "test case" > /hello
		
		FROM ubuntu as runtime
		COPY --from=builder /hello /hello
		CMD ["cat","/hello"]`.replaceAll(/^[\t ]+/gm, ''))
})
