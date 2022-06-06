import * as C from "../../lib/util/collection.ts";
import { assertEquals } from "../common.ts";

Deno.test('equalSets', () => {
	assertEquals(C.equalSets(new Set([1,2,3]), new Set([1,2,3])), true)
	assertEquals(C.equalSets(new Set([1,2,3]), new Set([1,2,3,4])), false)
	assertEquals(C.equalSets(new Set([1,2,3]), new Set([1,2])), false)
	assertEquals(C.equalSets(new Set([1,2,3]), new Set([1,2,4])), false)
})

Deno.test('sortBy', () => {
	assertEquals(C.sortBy(['one', 'seventeen', 'three'], x => x.length), ['one', 'three', 'seventeen'])
	assertEquals(C.sortBy(['one', 'seventeen', 'three'], x => x.length, true), ['seventeen', 'three', 'one'])
})
