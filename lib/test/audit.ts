// A minimal implementation of https://github.com/timbertson/auditspec

interface Waiter<T> {
	predicate: (log: Array<T>) => boolean
	resolve: (log: Array<T>) => void
}

export class Audit<T> {
	private waiters: Array<Waiter<T>> = []
	private log: Array<T> = []

	constructor() {
	}
	
	get(): Array<T> { return this.log }

	record(interaction: T): void {
		this.log.push(interaction)
		this.updated()
	}

	reset(): Array<T> {
		const log = this.log
		this.log = []
		this.updated()
		return log
	}

	waitUntil(predicate: (log: Array<T>) => boolean): Promise<Array<T>> {
		const waiters = this.waiters
		const p = new Promise<Array<T>>((resolve) =>
			waiters.push({
				predicate,
				resolve
			})
		)
		this.updated() // trigger immediately if already satisfied
		return p
	}

	private updated() {
		const log = this.log
		const triggered: Array<Waiter<T>> = []
		this.waiters = this.waiters.filter(waiter => {
			if (waiter.predicate(log)) {
				triggered.push(waiter)
				return true
			}
		})
		for (const waiter of triggered) {
			waiter.resolve(log)
		}
	}
}
