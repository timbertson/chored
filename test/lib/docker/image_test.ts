import * as D from '../../../lib/docker/file.ts'
import { assertEquals } from "../../common.ts";

const ubuntu = D.image('ubuntu')

Deno.test('image render', () => {
	assertEquals(D.ImageExt.show(ubuntu), 'ubuntu')
	assertEquals(D.ImageExt.show(ubuntu.withDigest('sha256:123')), 'ubuntu@sha256:123')
	assertEquals(D.ImageExt.show(ubuntu.withTag('20.06')), 'ubuntu:20.06')
	assertEquals(D.ImageExt.show({ url: 'ubuntu', tag: 'tag', digest: 'd'}), 'ubuntu@d')
})
