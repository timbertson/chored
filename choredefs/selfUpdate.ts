import * as Update from '../lib/self_update.ts'
import { computeLock } from "../lib/lock.ts";
import bump from "../lib/chore/bump.ts";
import render from "./render.ts";
import { equalSets } from "../lib/util/collection.ts";
import * as Git from "../lib/git.ts";
import { run } from "../lib/cmd.ts";

async function runWith(handler: Update.Handler) {
	const initialLock = await computeLock()
	// console.log("INITIAL", initialLock)
	await Update.selfUpdate({
		commitMessage: 'bump dependencies',
		update: async () => {
			await bump({})
		},
		handler: {
			wrap: handler.wrap,
			onChange: async () => {
				let lockChanged = false
				await handler.wrap(async () => {
					// There were changes, which have been committed.
					// It may be a no-op change though, if the lock digest is identical
					const finalLock = await computeLock()
					// console.log("FINAL", initialLock)
					lockChanged = !equalSets(new Set(Object.values(initialLock)), new Set(Object.values(finalLock)))
					if (lockChanged) {
						await render({})
						// add rendered changes (if any)
						if (await Git.uncommittedChanges() === null) {
							await Git.amendAllChanges({ includeUntracked: true })
						}
					} else {
						console.log("Lock unchanged; reverting commit")
						run(['git', 'reset', '--hard', 'HEAD^'])
					}
				})
				if (lockChanged) {
					await handler.onChange()
				}
			}
		}
	})
}

export async function pr(opts: {
	githubToken: string
}) {
	await runWith(await Update.pullRequestHandler({
		baseBranch: 'main',
		branchName: 'self-update',
		githubToken: opts.githubToken,
		prTitle: '[bot] update dependencies',
		prBody: ':robot: :rocket:',
		repository: { owner: 'timbertson', name: 'chored' },
	}))
}

export async function push(_: {}) {
	await runWith(await Update.pushHandler())
}

export default async function(_: {}) {
	await runWith(await Update.noopHandler)
}
