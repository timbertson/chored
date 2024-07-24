import { ExecutableFile } from "./file.ts";
import { replaceSuffix } from "../util/string.ts"

export interface Options {
	mainModule?: string,
}
export const mainModule = replaceSuffix(import.meta.url, 'render/bootstrap.ts', 'main.ts')
export const denoVersion = '1.22.0'

function makeScript(body: string) {
	return `
#!/usr/bin/env bash
_main() {
	set -euo pipefail
	if [ -z "\${DENO:-}" ]; then
		DENO="$(which deno 2>/dev/null || true)"
	fi
	if [ -z "\${DENO:-}" ]; then
		CHORED_CACHE="\${CHORED_CACHE:-$HOME/.cache/chored}"
		DENO_VERSION="\${DENO_VERSION:-${denoVersion}}"

		PLATFORM_ARCH=""
		# Add more as needed
		UNAME="$(uname -sm)"
		case "$UNAME" in
			"Darwin x86_64")
				PLATFORM_ARCH="x86_64-apple-darwin"
				;;

			"Linux x86_64")
				PLATFORM_ARCH="x86_64-unknown-linux-gnu"
				;;

			"Darwin arm64")
				PLATFORM_ARCH="aarch64-apple-darwin"
				;;

			*)
				echo >&2 "Error: Unknown platform/arch: $UNAME"
				exit 1
				;;
		esac
		[ -n "$PLATFORM_ARCH" ]
		DENO_DIR="$CHORED_CACHE/$PLATFORM_ARCH-$DENO_VERSION/"
		mkdir -p "$DENO_DIR"
		DENO="$DENO_DIR/deno"
		if [ ! -e "$DENO" ]; then
			ZIP_FILE="$DENO_DIR/deno.zip"
			curl -sSL "https://github.com/denoland/deno/releases/download/v$DENO_VERSION/deno-$PLATFORM_ARCH.zip" > "$ZIP_FILE"
			unzip -d "$DENO_DIR" "$ZIP_FILE"
			rm "$ZIP_FILE"
		fi
	fi

	DENO_ARGV=(--unstable --allow-all --check=local)
${body}
}

_main "$@"
`.trim()
}

export function wrapperText(opts: Options) {
	return makeScript(`
	here="$PWD"

	if [ "\${1:-}" = "--deno" ]; then
		shift
		exec "$DENO" "$@"
	fi

	CHORED_MAIN_FALLBACK='${opts.mainModule ?? mainModule}'
	CHORED_MAIN="\${CHORED_MAIN:-$CHORED_MAIN_FALLBACK}"

	if [ "\${1:-}" = "--local" ]; then
		shift
		IMPORT_MAP_URL="$("$DENO" run "\${DENO_ARGV[@]}" "$CHORED_MAIN" localImportMap)"
		[ $? -eq 0 ]
		DENO_ARGV+=(--import-map "$IMPORT_MAP_URL")
	else
		LOCKFILE="choredefs/lock.json"
		if [ -e "$LOCKFILE" ]; then
			DENO_ARGV+=(--lock="$LOCKFILE")
		fi
	fi

	if [ -n "$\{DENO_ARGS:-}" ]; then
		DENO_ARGV+=($DENO_ARGS)
	fi

	exec "$DENO" run "\${DENO_ARGV[@]}" "$CHORED_MAIN" "$@"
`)
}

export function bootstrapText() {
	return makeScript(`
	REPO="https://github.com/timbertson/chored.git"
	VERSION="$(git ls-remote --refs --tags --sort=-v:refname "$REPO" 'refs/tags/v*' | head -n 1 | sed -e 's@.*/@@')"
	BOOTSTRAP="https://deno.land/x/chored@$VERSION/lib/bootstrap.ts"
	exec "$DENO" run "\${DENO_ARGV[@]}" "\${BOOTSTRAP_OVERRIDE:-$BOOTSTRAP}"
`)
}

export function wrapperScript(opts: Options) {
	return new ExecutableFile("chored", wrapperText(opts))
}
