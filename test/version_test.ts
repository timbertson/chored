import { assertEquals } from './common.ts'
import { Version } from '../lib/version.ts'

const nums = (...numbers: number[]) => new Version('', numbers, '')

Deno.test('version parsing', () => {
	assertEquals(Version.parse('1.2.3'), nums(1,2,3))
	assertEquals(Version.parse('v1.2.3rc1'), new Version('v', [1,2,3], 'rc1'))
	assertEquals(Version.parse('v1.2.3rc1')?.format(), 'v1.2.3rc1')
	assertEquals(Version.parse('version-10.200.33'), new Version('version-', [10,200,33], ''))
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
