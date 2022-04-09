#!bash -eu

json="$(basename "$2" .ts)".json
gup -u "$json"
./node_modules/.bin/json2ts --input "$json" --output "$1"
