import { equalSets } from "../../lib/util/collection.ts";
import { assertEquals } from "../common.ts";

Deno.test('equalSets', () => {
	assertEquals(equalSets(new Set([1,2,3]), new Set([1,2,3])), true)
	assertEquals(equalSets(new Set([1,2,3]), new Set([1,2,3,4])), false)
	assertEquals(equalSets(new Set([1,2,3]), new Set([1,2])), false)
	assertEquals(equalSets(new Set([1,2,3]), new Set([1,2,4])), false)
})
