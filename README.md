# Chored

Chores, sorted.

`chored` lets you share chore definitions and code between many repositories. Built on [`deno`][] with Typescript, it requires zero-installation and has lightweight, on-demand dependencies.

You can use it for anything, but it's got first-class support for managing CI / CD files and chores (tasks):

 - Generate (and update!) files from higher level abstractions:
   - Github Action workflows
   - Dockerfiles
   - .gitattributes
   - Kubernetes manifests
   - arbitrary tool configurations (linters, compilers, build tools, etc)
 - Automatically bump remote typescript dependencies (for github and deno land)

Chored is still experimental, it probably doesn't do what you want yet.

[deno]: https://deno.land/

---

# Installation

TODO

# Running a third-party chore

TODO

# Creating your own choredef

Choredefs are simply functions that accept a single `options` argument. Export a `main` function in a file under `choredefs/`, boom you've made a chore with that filename.

Instead of running a third-party chore directly, it's usually more convenient to add an alias. e.g. create `choredefs/greet.ts` containing:

```ts
export * from 'TODO'
```

You can also import the third party chore but expose a wrapper function, which passes options specific to your project, for example.

```ts
import { greet } from 'TODO'
```

# Dependency granularity

Since it's built on [`deno`][], remote dependencies are simply typescript `imports`, and they're fetched only when first used - if you don't import a module, its dependencies don't need to be downloaded.

# Chored aims to solve problems with...

**Repetitive CI definitions:** Want to run the same (or similar) Github Workflows in many different repositories? Write a function _once_ to generate a whole workflow (or maybe just a few steps), and call it from each repository.

**Repetitive boilerplate between repositories:** CI definitions are just a special case of files which might need some tweaks for a given project, but are pretty similar and could easily be shared (with some parameterisation). Configuration for compilers, build tools, publication scripts, etc.

**Reusable development chores**: many languages have a kind of task runner (rake, npm scripts, etc). They usually have ways to share common tasks, but they're usually heavyweight (publish a package). With `chored`, sharing a chore is as simple as writing its URL in an `import` statement.

**CI lock-in**: most forms of re-use (e.g. Githb Actions) are tied to a vendor. If you have a better form of abstraction (like a real programming language), you don't need to invest in vendor-specific form of reuse (defining and referencing Github Actions).

**CI spaghetti-code**: we used to struggle with "works on my machine", now it's often "only works in CI". When CI steps are a thin wrapper around chores, we have the ability to run (and test!) that same code on developer machines. It won't magically make your environment consistent between dev and CI, but it can give you the tooling to manage that better.

# Features

## Filling the CI/CD YAML Sandwich

YAML and Javascript, that seems to be what the world has come to :shrug:

The `render` system contains functionality for declaratively specifying a set of generated files (typically YAML), and writing them to the filesystem. This takes inspiration from [projen](https://github.com/projen/projen), although it's much more minimal.

Using this, you can run a `chored` function to locally generate YAML files for github actions, and then those YAML files can run more `chored` functions from your CI. Keeping your CI actions in `chored` functions means you can also run them from your local machine, or a Kubernetes job, or wherever.

## Utility scripts & glue

Often these end up written in bash because it's always there. With chored, you've got the full power of typescript and [deno], through a ~100-line wrapper script committed in-repo.

## Choredefs

Writing a CLI is tedious. Calling a function is easy. Chored runs a function accepting a single `options` argument. You can use `--string foo bar` to set properties on that single options argument.

It looks like this, for example:

```ts
// choredefs/greet.ts
export function main(opts: { name: string, home: string }) {
	console.log(`Hello, ${opts.name}. I see your home directory is ${opts.home}`)
}
```

```sh
$ ./chored greet --string name "Tim" --env home HOME
```

You can put multiple functions in the one file, by passing the function name after the chore name (e.g. `./chored greet dev` would run the `dev` function in `choredefs/greet.ts`).

`--string foo bar` and `--bool someFeature true` also have shorthands, e.g. `--foo=bar` and `--someFeature`

# Pros:

### Mainstream language

Typescript, it's a whole thing!

### Lightweight code reuse

It doesn't get easier than "import code from the internet"

### Lightweight chore definitions

A chore is just a function

### Static typing

Missed out some options? Importing an incompatible version of a library? Get a type error upfront instead of an obscure runtime bug.

# Cons:

### Size:

`deno` isn't tiny; it's an 80mb binary (when decompressed). It's reused across invocations of course, but if you run it on ephemeral VMs that won't help you.

### Niche:

Typescript is incredibly mainstream, but most people use it with `node`. `deno`'s flavour has some pecliarities that may make reuse and IDE integration less than perfect.

### Lack of automated dependency updates:

The downside of "import from the internet" is that there's no easy way to bump dependencies to the latest version, because you'd have to understand arbitrary URL structures and also figure out how to even fid out what the "latest" is.

This is a general problem with `deno`, so I'm not the only one interested in a solution. There's probably something hacky we can do for a few well-known hosts.

# Comparisons:

### Projen

There's a lot of similarities with projen, and `chored` takes quite a few cues from `projen`. The main differences:

 - projen focuses heavly on pre-canned project types. Chored is (currently) less opinionated and requires some more curation
 - projen's task system requires a bit more effort and configuration, but suppots arbitrary programs instead of just typesceipt
 - typescript is spported in projen, but it requires nonstandard setup

### Github actions

github actions are quite nice, but they have some serious usability issues.

 - you can't run actions locally
 - you're locked into github's ecosystem
 - reuse is low: actions are reusable, but if they don't do _exactly_ what you need you're out of luck, you'll need to create a new one

### Dagger

A recent addition to this space, uses the `cue` language for configuration and the docker `BuildKit` backend for portability. The differences mostly stem from the choice of building blocks. Chored's unit of abstraction is a typescript function, while Dagger's is a command running in a docker container.

 - both cue and deno support remote imports (yay!)
 - dagger has a more consistent runtime environment (it's docker)
 - dagger is coarse and heavyweight in terms of making docker images and defining tasks, it's much more work than writing a Typescript function.
 - dagger is intended for defining CI tasks, which you can also run locally. It's unclear how convenient it is for running ad-hoc tasks on a developer machine

### dhall-ci (with dall-render)

Dhall ci is the precursor to chored - it was built with similar goals, on the same ideals.

The main difference is that dhall-render only really handles file generation. Whereas with chored that's just one builtin chore, there are countless others that can be executed on your development machine, in CI, or both.

 - both dhall and deno support remote imports
 - dhall is an intentionally limited language, typescript is very liberal. Dhall forces good hygeine, but this can make some things unpleasant to represent ergonomically
 - dhall-ci only handles the generation of files using reusable components, it doesn't have anything to say about actually runing reusable code within CI or on your machine
 - dhall-render ends up generating a number of its own internal scripts in each repo, which is distasteful. chored has a much lower footprint in terms of generated files, because of its ability to remotely import code (not just expressions)
 - dhall-ci assumes you already have dhall and ruby installed, chored is fully self-bootstrapping

### `npx`

`npm` is really a compettor to `deno`, not `chored`, since it's basically a way to "run node packages without installing them first". `chored` could have been built on `npx`, but it would have been worse:

 - dependencies are coarse-grained and per-project, a package is the smallest unit of re-use and can't be required only for certain tasks
 - less self-contained (it would need `node`, `npx` and a typescript compiler)


---

## On zero-installation

I have a long history of appreciating systems which don't require _stateful_ management. That is, running (or building) a program shouldn't care what's on your system, it should just **do the right thing**. Systems supporting this mode of operation feel conceptually like you can just "run code from the internet", although obviously they have caching to ensure you only pay the cost of downloading a program once.

 - zero install
 - nix
 - dhall

Nix is the most mainstream of these, but it's also a big investment - you have to go all in. Deno is likely to be somewhat mainstream, and is very low investment, because you can (largely) just Run Some Typescript.
