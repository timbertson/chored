import { assertEquals, assertThrows } from './common.ts'
import { Version } from '../lib/version.ts'

const nums = (...numbers: number[]) => new Version(numbers)

Deno.test('version parsing', () => {
	assertEquals(Version.parseLax('1.2.3'), nums(1,2,3))
	assertEquals(Version.parseLax('foo'), null)
	assertEquals(Version.parseLax('v1.2.3-rc')?.show(), '1.2.3')
	assertEquals(Version.parseLax('v1.2.3')?.show(), '1.2.3')
	assertEquals(Version.parseLax('version-10.200.33'), nums(10,200,33))

	assertEquals(Version.parse('1.2.3'), nums(1,2,3))
	assertEquals(Version.parse('v1.2.3'), nums(1,2,3))
	assertThrows(() => Version.parse('v1.2.3-rc1'))
})

Deno.test('ordering',() => {
	const versions = [
		nums(1, 2, 3),
		nums(1),
		nums(2, 1),
		nums(0, 1, 2)
	]
	versions.sort(Version.compare)
	assertEquals(versions, [
		nums(0, 1, 2),
		nums(1),
		nums(1, 2, 3),
		nums(2, 1),
	])
})
