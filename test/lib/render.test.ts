import { assertEquals } from '../common.ts'
import * as Render from '../../lib/render/index.ts'
import { MARKER, writeMode, WriteableOpts } from '../../lib/render/fileInternal.ts'
import { FakeFS } from '../../lib/fsImpl.ts'

function render(files: Array<Render.Writeable>, fs: FakeFS): Promise<void> {
	return Render.render(files, {}, fs)
}

Deno.test("render files", async () => {
	const fs = new FakeFS()
	fs.writeTextFile("previously-generated", "contents")
	fs.writeTextFile(".gitattributes", "previously-generated linguist-generated denon-generated\nnonexistent denon-generated")
	fs.writeTextFile("manual", "contents")
	
	await render([
		new Render.RawFile("generated", "contents"),
		new Render.RawFile("nested/generated", "contents"),
	], fs)
	
	const attrLine = (path: string) => `${path} linguist-generated denon-generated`
	assertEquals(
		fs.files['.gitattributes'],
		[
			`# ${MARKER}`,
			"",
			attrLine(".gitattributes"),
			attrLine("generated"),
			attrLine("nested/generated"),
		].join("\n"),
		"gitattributes contents"
	)
	
	await fs.remove('.gitattributes')
	assertEquals(
		fs.files,
		{
			"generated": "contents",
			"manual": "contents",
			"nested/generated": "contents",
		},
		"remaining file contents"
	)

	assertEquals(fs.dirs['nested'], true, "parent directory created")
});

Deno.test("render mode", () => {
	const mode = (opts: WriteableOpts) => writeMode(opts).toString(8)
	assertEquals(mode({}), "400") // r--
	assertEquals(mode({ executable: true }), "500") // r-x
	assertEquals(mode({ readOnly: false }), "600") // rw-
	assertEquals(mode({ readOnly: false, executable: true }), "700") // rwx
})

Deno.test("shebang formatting", async () => {
	const contents = new Render.ExecutableFile("dest", "#!/usr/bin/env bash\necho HELLO").serialize().split("\n")
	assertEquals(contents, ["#!/usr/bin/env bash", `# ${MARKER}`, "", "echo HELLO"])
})
