import { ExecutableFile } from "./file.ts";

const thisModule = import.meta.url
const suffixLocation = thisModule.lastIndexOf('/lib/')
if (suffixLocation < 0) {
	throw new Error("invalid self url")
}

export interface Options {
	mainModule?: string,
}
export const mainModule = thisModule.substring(0, suffixLocation) + "/main.ts"
export const denoVersion = '1.18.0'

function makeScript(body: string) {
	return `
#!/usr/bin/env bash
_main() {
	set -euo pipefail
	if [ -z "\${DENO:-}" ]; then
		DENO="$(which deno 2>/dev/null || true)"
	fi
	if [ -z "\${DENO:-}" ]; then
		DENON_CACHE="\${DENON_CACHE:-$HOME/.cache/denon}"
		DENO_VERSION="\${DENO_VERSION:-${denoVersion}}"

		PLATFORM_ARCH=""
		# Add more as needed
		case "$(uname -sm)" in
			"Darwin x86_64")
				PLATFORM_ARCH="x86_64-apple-darwin"
				;;

			"Linux x86_64")
				PLATFORM_ARCH="x86_64-unknown-linux-gnu"
				;;
		esac
		[ -n "$PLATFORM_ARCH" ]
		DENO_DIR="$DENON_CACHE/$PLATFORM_ARCH-$DENO_VERSION/"
		mkdir -p "$DENO_DIR"
		DENO="$DENO_DIR/deno"
		if [ ! -e "$DENO" ]; then
			ZIP_FILE="$DENO_DIR/deno.zip"
			curl -sSL "https://github.com/denoland/deno/releases/download/v$DENO_VERSION/deno-$PLATFORM_ARCH.zip" > "$ZIP_FILE"
			unzip -d "$DENO_DIR" "$ZIP_FILE"
			rm "$ZIP_FILE"
		fi
	fi

	DENO_ARGS=(--unstable --allow-all)
${body}
}

_main "$@"
`.trim()
}

export function denonBinText(opts: Options) {
	return makeScript(`
export DENO
export DENON_TASKS="$PWD/denon-tasks"

here="$PWD"
tmp="$TMPDIR"

LOCKFILE="$DENON_TASKS/.lock.json"
if [ -e "$LOCKFILE" ]; then
	DENO_ARGS+=(--lock="$LOCKFILE")
fi

if [ "\${1:-}" = "--exec" ]; then
	shift
	exec "$DENO" "$@"
fi

DENON_MAIN_FALLBACK='${opts.mainModule ?? mainModule}'

exec "$DENO" run "\${DENO_ARGS[@]}" "\${DENON_MAIN:-$DENON_MAIN_FALLBACK}" "$@"
`)
}

export function bootstrapText() {
	return makeScript(`
BOOTSTRAP='https://TODO-PUBLIC-URL.example.com/'
exec "$DENO" run "\${DENO_ARGS[@]}" "\${BOOTSTRAP_OVERRIDE:-$BOOTSTRAP}"
`)
}

export function wrapperScript(opts: Options) {
	return new ExecutableFile("denon", denonBinText(opts))
}
