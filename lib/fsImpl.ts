import { dirname } from "https://deno.land/std@0.132.0/path/mod.ts"

export interface FS {
	// subset of Deno interface
	readTextFile(path: string): Promise<string>
	writeTextFile(path: string, contents: string): Promise<void>
	existsSync(path: string): boolean
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

// utils for an arbitrary FN impl
export function FSUtil(fs: FS) {
	const Self = {
		mkdirp: async function(path: string): Promise<void> {
			if (!fs.existsSync(path)) {
				await Self.mkdirp(dirname(path))
				await fs.mkdir(path)
			}
		}
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
		// TODO: normalize
		const contents = this.files[path]
		if (contents == null) {
			throw new Deno.errors.NotFound(path)
		}
		return Promise.resolve(contents)
	}

	writeTextFile(path: string, contents: string): Promise<void> {
		this.files[path] = contents
		return Promise.resolve()
	}

	existsSync(path: string): boolean {
		return (this.files[path] || this.dirs[path]) != null
	}

	remove(path: string): Promise<void> {
		if (!this.existsSync(path)) {
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
}

const DenoFSImpl: FS = {
	readTextFile: function(path: string): Promise<string> {
		return Deno.readTextFile(path)
	},

	writeTextFile: function(path: string, contents: string): Promise<void> {
		return Deno.writeTextFile(path, contents)
	},
	
	existsSync: function(filePath: string): boolean {
		try {
			Deno.lstatSync(filePath);
			return true;
		} catch (err) {
			if (FSUtilPure.isNotFound(err)) {
				return false;
			}
			throw err;
		}
	},

	remove: Deno.remove,
	rename: Deno.rename,
	mkdir: Deno.mkdir,
}

export const DenoFS = {
	...DenoFSImpl,
	...FSUtil(DenoFSImpl),
}
