export default function greet(opts: { name: string, home?: string }) {
	console.log(`Hello, ${opts.name}. I see your home directory is ${opts.home ?? Deno.env.get('HOME')}`)
}

greet.help = `
Greet the user. Options:

  - name: string
	- home: string? (default $HOME)
`.trim()
