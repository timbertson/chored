import { trimIndent } from "../../../lib/util/string.ts";
import { assertEquals } from "../../common.ts";

Deno.test('trimIndent', () => {
	assertEquals(trimIndent(`
		hello!
		 extra space!
		`), 'hello!\n extra space!\n')

	assertEquals(trimIndent(`
			a
		b`), '\ta\nb')

	assertEquals(trimIndent(`
    a
    b`), 'a\nb')

	assertEquals(trimIndent(`
			a
		  b`), '\ta\n  b')

	assertEquals(trimIndent(`
		a

		b
	`), 'a\n\nb\n')
})
