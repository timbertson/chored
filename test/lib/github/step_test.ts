import { assertEquals } from '../../common.ts'

import * as Step from '../../../lib/github/step.ts'

const defaultCheckout = {
	name: 'Checkout',
	uses: 'actions/checkout@v3'
}

const defaultSetup = {
	name: 'Setup chored',
	uses: 'timbertson/chored-setup@v1'
}

Deno.test('checkout', () => {
	assertEquals(Step.checkout(), defaultCheckout)
})

Deno.test('setupStep', () => {
	assertEquals(Step.setupStep(), defaultSetup)
})

Deno.test('setupSteps', () => {
	assertEquals(
		Step.setupSteps(),
		[ defaultCheckout, defaultSetup ])
})

Deno.test('chore', () => {
	assertEquals(
		Step.chore({ name: 'foo' }),
		{
			name: "foo",
			run: "./chored foo",
		})

	assertEquals(
		Step.chore({
			name: 'push',
			stepName: 'Push to branch',
			opts: {
				token: Step.secret('github_token'),
				home: Step.envVar('HOME'),
				verbose: true,
			},
		}),
		{
			name: "Push to branch",
			run: './chored push --env home HOME --json "$OPTS"',
			env: {
				OPTS: JSON.stringify({ token: '${{ secrets.github_token }}', verbose: true })
			}
		})
})
