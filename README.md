# Denon

Zero-installation deno wrapper.


## On zero-installation

I have a long history of things which don't require _stateful_ management. That is, running (or building) a program shouldn't care what's on your system, it should just **do the right thing**. Systems supporting this mode of operation feel conceptually like you can just "run code from the internet", although obviously they have caching to ensure you only pay the cost of downloading a program once.

 - zero install
 - nix
 - dhall

Nix is the most mainstream of these, but it's also a big investment - you have to go all in. Deno is likely to be somewhat mainstream, and is very low investment, because you can (largely) just Run Some Typescript.

# What does `denon` add?

Deno allows you to run code from the internet, but installing deno is left up to the user. `denon` is not aiming to be an all-signing, all-dancing `deno` version manager.

Nope, `denon` gives you a little script (or github action, or docker image, etc) you can drop into your repo, and it'll run `deno` for you, downloading it first if it's missing.

In addition to this, `denon` provides some conveneint support for entrypoints. `deno` lets you run comand line applications, but when you're glueing together things it'd be nice to have soething that felt more like running a function.

## Locking and caching:

Denon assumes you'll want to pin nearly all of your dependencies. This is helpful for caching, security and reliable reproduction. So caching is built in.

```
$ ./denon lock ./main.ts
```

# Sample usage:

```
// https://example.com/script.ts
export function greet(opts: { name: string, home: string }) {
	console.log(`Hello, ${opts.name}. I see your home directory is ${opts.home}`)
}
```

```bash
$ ./denon call 'https://example.com/script.ts#greet' --string name "Tim" --env home HOME
```
