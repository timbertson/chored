// As of deno 2.x, import() no longer does any type checking.
// But we're using it to defer dependencies to runtime
// (or load generated modules), in both cases we still want typechecking
export async function importWithTypeChecking(mod: string): Promise<any> {
	const cmd = new Deno.Command(Deno.execPath(), {
		args: ['check', mod],
		stdin: 'null',
		stdout: 'inherit',
	})
	const result = await cmd.output()
	if(!result.success) {
		const output = new TextDecoder().decode(result.stderr)
		throw new Error(`Compilation of module ${mod} failed:\n${output}`)
	}
	// typechecking done, import it
	return import(mod)
}
