import { lock, lockPath } from '../deps/lock.ts'
export default function lockChore(_: {}): Promise<void> {
	return lock()
}

lockChore.help = `
Create a deno lock file at ${lockPath()}
This will be used by \`chored\` when present.
`.trim()
