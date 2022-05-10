import { lock, lockPath } from '../lock.ts'
export default function lockChore(opts: {}): Promise<void> {
	return lock()
}

lockChore.help = `
Create a deno lock file at ${lockPath()}
This will be used by \`chored\` when present.
`.trim()
