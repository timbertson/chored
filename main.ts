// present for backwards compat
import { defaultConfig } from './lib/main/config.ts'
import { main } from './lib/main.ts'

if (import.meta.main) {
	main(defaultConfig, Deno.args.slice())
}
