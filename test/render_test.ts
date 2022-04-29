import { assertEquals } from './common.ts'
import * as Render from '../lib/render.ts'
import { MARKER, writeMode, FileOpts } from '../lib/render/file_internal.ts'
import { FakeFS } from '../lib/fs/impl.ts'

function render(files: Array<Render.File>, fs: FakeFS): Promise<void> {
	return Render.render(files, {}, fs)
}

Deno.test("render files", async () => {
	const fs = new FakeFS()
	fs.writeTextFile("previously-generated", "contents")
	fs.writeTextFile(".gitattributes", "previously-generated linguist-generated chored-generated\nnonexistent chored-generated")
	fs.writeTextFile("manual", "contents")
	
	await render([
		new Render.RawFile("generated", "contents"),
		new Render.RawFile("nested/generated", "contents"),
	], fs)
	
	const attrLine = (path: string) => `${path} linguist-generated chored-generated`
		fs.files['.gitattributes'],
	assertEquals(
		fs.files['.gitattributes'],
		[
			`# ${MARKER}`,
			"",
			attrLine(".gitattributes"),
			attrLine("chored"),
			attrLine("generated"),
			attrLine("nested/generated"),
		].join("\n") + "\n")
	
	await fs.remove('.gitattributes')
	await fs.remove('chored')
	assertEquals(
		fs.files,
		{
			"generated": "contents",
			"manual": "contents",
			"nested/generated": "contents",
		})

	assertEquals(fs.dirs['nested'], true, "parent directory created")
});

Deno.test("render mode", () => {
	const mode = (opts: FileOpts) => writeMode(opts).toString(8)
	assertEquals(mode({}), "400") // r--
	assertEquals(mode({ executable: true }), "500") // r-x
	assertEquals(mode({ readOnly: false }), "600") // rw-
	assertEquals(mode({ readOnly: false, executable: true }), "700") // rwx
})

Deno.test("shebang formatting", async () => {
	const contents = new Render.ExecutableFile("dest", "#!/usr/bin/env bash\nline1\nline2").serialize().split("\n")
	assertEquals(contents, ["#!/usr/bin/env bash", `# ${MARKER}`, "", "line1", "line2", ""])
})
