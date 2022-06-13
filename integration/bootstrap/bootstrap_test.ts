import { run } from "../../lib/cmd.ts";
import withTempDir from '../../lib/fs/with_temp_dir.ts'
import { sort } from "../../lib/util/collection.ts";
import { notNull } from "../../lib/util/object.ts";
import { assertEquals } from "../../test/common.ts";

const readdir = (p: string) => sort(Array.from(Deno.readDirSync(p)).map(entry => entry.name))

Deno.test('bootstrap', () => withTempDir({}, async (dir: string) => {
	const installation = ((await Deno.readTextFile('README.md'))
		.split('\n')
		.find(line => line.startsWith('curl'))
	)
	await run(['bash', '-c', notNull(installation)], { cwd: dir })
	assertEquals(readdir(dir), ['.gitattributes', 'chored', 'choredefs'])
	assertEquals(readdir(dir + '/choredefs'), ['render.ts'])
	console.log(await Deno.readTextFile(`${dir}/choredefs/render.ts`))
}))
