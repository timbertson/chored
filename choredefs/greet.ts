export default function(opts: { name: string, home?: string }) {
	console.log(`Hello, ${opts.name}. I see your home directory is ${opts.home ?? Deno.env.get('HOME')}`)
}
