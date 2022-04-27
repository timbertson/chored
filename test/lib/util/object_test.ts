import withTempFile from "../../../lib/fs/with_temp_file.ts";
import { deepMerge, deepMergeWith } from "../../../lib/util/object.ts";
import { replaceSuffix, trimIndent } from "../../../lib/util/string.ts";
import { assertEquals } from '../../common.ts'

interface Attributes {
	foo: string,
	bar: string,
	extra: { [index: string]: string }
}

interface Person {
	name: string,
	age: number,
	updatedAt: Date,
	tags: string[],
	attributes: Attributes
}

Deno.test('deepMerge', () => {
	const base: Person = {
		name: 'Deno',
		age: 13,
		updatedAt: new Date("2020-01-01"),
		tags: ['dinosaur', 'prehistoric'],
		attributes: {
			foo: 'foo',
			bar: 'bar',
			extra: {
				one: '1',
				two: '2',
			}
		}
	}
	const merged: Person = deepMerge(base, {
		name: 'Dino',
		updatedAt: new Date("2022-01-01"),
		attributes: { foo: 'foo?', extra: { three: '3' } } })
	assertEquals(merged.name, 'Dino')
	assertEquals(merged.age, 13)
	assertEquals(merged.updatedAt, new Date("2022-01-01"))
	assertEquals(merged.updatedAt instanceof Date, true)
	assertEquals(merged.attributes.foo, 'foo?')
	assertEquals(merged.attributes.extra, { ... base.attributes.extra, three: '3' })
})

;(() => {
	const base = {
		foo: [1, 2, 3],
		bar: ['four', 'five', 'six'],
	}
	const override1 = { foo: [3, 4], }
	const override2 = { foo: [5], bar: ['seven', 'six'] }

	Deno.test('deepMerge array union', () => {
		assertEquals(deepMergeWith({ arrays: 'union' })(base, override1, override2),
		{
			foo: [1, 2, 3, 4, 5],
			bar: ['five', 'four', 'seven', 'six' ],
		})
	})

	Deno.test('deepMerge array replace', () => {
		assertEquals(deepMergeWith({ arrays: 'replace' })(base, override1, override2),
		{
			foo: [5],
			bar: ['seven', 'six'],
		})
	})

	Deno.test('deepMerge array concat', () => {
		assertEquals(deepMergeWith({ arrays: 'concat' })(base, override1, override2),
		{
			foo: [1, 2, 3, 3, 4, 5],
			bar: ['four', 'five', 'six', 'seven', 'six'],
		})
	})
	
	async function doesNotCompile(code: string, expected: string): Promise<void> {
		const objectURL = replaceSuffix(import.meta.url, 'object_test.ts', "../../../lib/util/object.ts")
		await withTempFile({ suffix: '.ts' }, async (p) => {
			const fullCode = `import { deepMerge } from '${objectURL}'\n${trimIndent(code)}`
			await Deno.writeTextFile(p, fullCode)
			let error: Error | null = null
			try {
				await import(`file://${p}`)
			} catch (e) {
				error = e as Error
			}
			if (error === null) {
				throw new Error(`code import succeeded:\n${fullCode}`)
			}
			if (error.message.lastIndexOf(expected) === -1) {
				assertEquals
				throw new Error(`Compilation error test case:\n-----\n${fullCode}\n------\nexpected error: ${expected}\n but was: ${error.message}`, error)
			}
		})
	}

	Deno.test('compilation failures', async (t) => {
		const pointDef = `
			interface Point {
				x: number,
				y: number,
			}

			interface Points {
				[index: string]: Point
			}

			interface HasPointList {
				points: Point[]
			}
		`

		await t.step('indexed types are not partialized', () => doesNotCompile(`
			${pointDef}
			deepMerge<Points>({ a: { x: 1, y: 1 }, b: { x: 2, y: 2 } },
				{ c: { x: 1 } })
		`, `Property 'y' is missing in type '{ x: number; }' but required in type 'Point'`)
		)

		await t.step('array types are not partialized', () => doesNotCompile(`
			${pointDef}
			deepMerge<HasPointList>({ points: [{ x: 1, y: 1 }] },
				{ points: [{ y: 1 }] })
		`, `Property 'x' is missing in type '{ y: number; }' but required in type 'Point'`)
		)
	})

})()
