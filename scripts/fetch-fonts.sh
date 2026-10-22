#!/bin/sh
# Downloads the two open-licence typefaces into public/fonts so the site never
# loads fonts from a third party. Run once: npm run fonts
set -eu
cd "$(dirname "$0")/../public/fonts"
BASE="https://cdn.jsdelivr.net/npm"
fetch() { echo "  $2"; curl -fsSL "$1" -o "$2"; }
echo "Downloading fonts into public/fonts..."
fetch "$BASE/@fontsource-variable/bricolage-grotesque@5/files/bricolage-grotesque-latin-wght-normal.woff2" bricolage-grotesque-latin-variable.woff2
for w in 400 700; do
  fetch "$BASE/@fontsource/atkinson-hyperlegible@5/files/atkinson-hyperlegible-latin-$w-normal.woff2" "atkinson-hyperlegible-latin-$w-normal.woff2"
done
fetch "$BASE/@fontsource/atkinson-hyperlegible@5/files/atkinson-hyperlegible-latin-400-italic.woff2" atkinson-hyperlegible-latin-400-italic.woff2
echo "Done. Commit the files in public/fonts."
