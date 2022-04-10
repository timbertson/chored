import { dirname } from "https://deno.land/std@0.133.0/path/mod.ts"

export interface FS {
	// subset of Deno interface
	readTextFile(path: string): Promise<string>
	writeTextFile(path: string, contents: string, options?: Deno.WriteFileOptions): Promise<void>
	exists(path: string): Promise<boolean>
	chmod(path: string, mode: number): Promise<void>
	mkdir(path: string): Promise<void>
	remove(path: string): Promise<void>
	rename(src: string, dest: string): Promise<void>
}

const FSUtilPure = {
	dirname: dirname,

	isNotFound: function(err: any): boolean {
		return (err instanceof Deno.errors.NotFound)
	},
}

// utils for an arbitrary FS impl
export function FSUtil(fs: FS) {
	async function retryWithChmod(path: string, fn: () => Promise<void>) {
		try {
			await fn()
		} catch(e) {
			if (e instanceof Deno.errors.PermissionDenied) {
				// assume it's just a missing write permission
				await fs.chmod(path, 0o600)
				await fn()
			} else {
				throw e
			}
		}
	}

	const Self = {
		mkdirp: async function(path: string): Promise<void> {
			if (! await fs.exists(path)) {
				await Self.mkdirp(dirname(path))
				await fs.mkdir(path)
			}
		},

		forceWriteTextFile: async function(path: string, contents: string, useTemp: boolean, opts: Deno.WriteFileOptions): Promise<void> {
			const writeDest = useTemp ? path + '.tmp' : path
			await retryWithChmod(writeDest, () => fs.writeTextFile(writeDest, contents, opts))
			if (useTemp) {
				await retryWithChmod(path, () => fs.rename(writeDest, path))
			}
		},

		removeIfPresent: async function(path: string): Promise<boolean> {
			try {
				await fs.remove(path)
				return true
			} catch(e) {
				if (FSUtilPure.isNotFound(e)) {
					return false
				} else {
					throw e
				}
			}
		},
	}

	return { ... Self, ...FSUtilPure }
}

// Doesn't handle normalization or directories at all.
// Used in testing
export class FakeFS implements FS {
	files: { [index: string]: string } = {}
	dirs: { [index: string]: boolean } = {}

	constructor() {
		this.files = {}
		// good enough to not have mkdirp explode :shrug:
		this.dirs = { '/' : true, '.': true }
	}

	readTextFile(path: string): Promise<string> {
		// TODO: normalize paths?
		const contents = this.files[path]
		if (contents == null) {
			throw new Deno.errors.NotFound(path)
		}
		return Promise.resolve(contents)
	}

	writeTextFile(path: string, contents: string, options?: Deno.WriteFileOptions): Promise<void> {
		this.files[path] = contents
		return Promise.resolve()
	}

	exists(path: string): Promise<boolean> {
		return Promise.resolve(path in this.files || path in this.dirs)
	}

	async remove(path: string): Promise<void> {
		if (! await this.exists(path)) {
			throw new Deno.errors.NotFound(path)
		}
		delete this.files[path]
		delete this.dirs[path]
		return Promise.resolve()
	}

	async rename(src: string, dest: string): Promise<void> {
		await this.writeTextFile(dest, await this.readTextFile(src))
		await this.remove(src)
	}
	
	mkdir(path: string): Promise<void> {
		this.dirs[path] = true
		return Promise.resolve()
	}

	chmod(path: string, mode: number): Promise<void> {
		return Promise.resolve()
	}
}

const DenoFSImpl: FS = {
	exists: async function(filePath: string): Promise<boolean> {
		try {
			await Deno.lstat(filePath);
			return true;
		} catch (err) {
			if (FSUtilPure.isNotFound(err)) {
				return false;
			}
			throw err;
		}
	},

	readTextFile: Deno.readTextFile,
	writeTextFile: Deno.writeTextFile,
	remove: Deno.remove,
	rename: Deno.rename,
	mkdir: Deno.mkdir,
	chmod: Deno.chmod,
}

export const DenoFS = {
	...DenoFSImpl,
	...FSUtil(DenoFSImpl),
}
