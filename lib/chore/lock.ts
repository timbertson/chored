import { lock } from '../lock.ts'
export default function(opts: {}): Promise<void> {
	return lock()
}
