import { describeVersion } from "../git.ts";

export default async function(opts: {
	ref?: string,
	devSuffix?: string | null
}) {
	const parsed = await describeVersion({ ref: opts?.ref })
	if (parsed.version == null) {
		console.warn("No current version found")
		Deno.exit(1)
	}
	console.log(parsed.version.show())
}
