import { assertEquals, assertThrows } from '../common.ts'
import { replaceSuffix } from '../../lib/util/string.ts'

Deno.test('replaceSuffix', () => {
	assertEquals(replaceSuffix('abcdefgh', 'gh', ' (etc)'), 'abcdef (etc)')
	assertThrows(() => replaceSuffix('abc', 'foo', 'bar'), undefined, 'abc does not end with foo')
})
