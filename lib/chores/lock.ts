import { lock } from '../lock.ts'
export function main(opts: {}): Promise<void> {
	return lock()
}
