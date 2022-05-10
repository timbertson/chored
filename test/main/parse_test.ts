import { parseArgs } from '../../lib/main.ts'
import { Code } from '../../lib/main/entrypoint.ts'
import { assertEquals } from '../common.ts'

interface MinimalOptions {
	main: string[]
	opts: { [index: string]: Code }
}

function parse(...argv: string[]): MinimalOptions {
	const { main, opts } = parseArgs(argv)
	return { main, opts }
}

Deno.test('parse args', () => {
	assertEquals(
		parse('foo', 'bar', '--string', 'name', 'adam'),
		{
			main: ['foo', 'bar'],
			opts: { name: Code.value('adam') }
		})

	assertEquals(parse('--bool', 'test', 'true').opts, { test: Code.value(true) })
	assertEquals(parse('--num', 'test', '32').opts, { test: Code.value(32) })
	assertEquals(parse('--json', '{ "test": true }').opts, { test: Code.value(true) })
	assertEquals(parse('--env', 'home', 'HOME').opts, { home: Code.env('HOME') })
	assertEquals(parse('foo', '--', 'bar', 'baz'), {
		main: ['foo'],
		opts: { args: Code.value(['bar', 'baz']) }
	})

	// terse parsing
	assertEquals(parse('--foo').opts, { foo: Code.value(true) })
	assertEquals(parse('--foo', '--no-bar').opts, { foo: Code.value(true), bar: Code.value(false) })
	assertEquals(parse('--foo', 'bar').opts, { foo: Code.value('bar') })
	assertEquals(parse('--foo=bar').opts, { foo: Code.value('bar') })
	assertEquals(parse('--foo=1').opts, { foo: Code.value(1) })
	assertEquals(parse('--foo=-11').opts, { foo: Code.value(-11) })
	assertEquals(parse('--foo', '1').opts, { foo: Code.value(1) })
	assertEquals(parse('--foo', '1.2').opts, { foo: Code.value('1.2') }) // we only only guess integers
	assertEquals(parse('--foo', 'false').opts, { foo: Code.value(false) })
})
