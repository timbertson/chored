export {existsSync} from "https://deno.land/std@0.132.0/fs/exists.ts";

export function isNotFound(err: any): boolean {
	return (err instanceof Deno.errors.NotFound)
}
