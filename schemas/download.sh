#!bash -eu

URL="none"
case "$2" in
	github_workflow.json)
		URL="https://raw.githubusercontent.com/SchemaStore/schemastore/master/src/schemas/json/github-workflow.json"
		;;

	*)
		echo >&2 "Unknown target: $2"
		exit 1
		;;
esac

curl -sSL "$URL" > $2
