import { defaulted } from "../../lib/util/function.ts";
import { assertEquals } from "../common.ts";

interface Opt {
	name?: string
	age?: number
}

Deno.test('defaulted', () => {
	const fn = defaulted<Opt, Opt>({ age: 1 }, (o: Opt) => o)
	assertEquals(fn({ name: 'tim' }), { name: 'tim', age: 1 })
	assertEquals(fn({ name: 'tim', age: 10 }), { name: 'tim', age: 10 })
})
