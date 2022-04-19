import { run } from "../../lib/cmd.ts";
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import { notNull } from "../../lib/util/object.ts";
import { assertEquals } from "../../test/common.ts";

Deno.test('bootstrap', () => withTempDir({}, async (dir: string) => {
	const installation = ((await Deno.readTextFile('README.md'))
		.split('\n')
		.find(line => line.startsWith('curl'))
	)
	await run(['bash', '-c', notNull(installation)], { cwd: dir })
	const dirContents = Array.from(Deno.readDirSync(dir))
	dirContents.sort()
	assertEquals(dirContents, ['.gitattributes', 'chored', 'choredefs'])
	assertEquals((await Deno.stat(dir + '/choredefs')).isFile, true)
}))
