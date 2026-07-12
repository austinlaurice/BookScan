# BookScan

Mobile-friendly static web app for scanning ISBN barcodes into local book collections, with optional sync to a Google Sheet. No backend, no build-time secrets — TypeScript bundled with esbuild, deployed as static files to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).

## Commands

```bash
npm install
npm run build   # esbuild bundle to dist/bundle.js + copy zxing_reader.wasm
npm run watch    # same, with --watch
npm run serve    # http-server on :8080
```

No test suite or linter is configured.

## Architecture

See `ARCHITECTURE.md` for the full breakdown. Short version: `src/app.ts` coordinates UI events and calls into `storage.ts` (localStorage CRUD), `scanner.ts` (zxing-wasm barcode decoding), `sync.ts` (fire-and-forget POST to a user-supplied Google Apps Script Web App), and `export.ts` (CSV export). All state lives in browser localStorage under `bookScan_collections` and `bookScan_syncSettings`.

## Key design decision: no book-details lookup

Scanning a barcode records the **ISBN only** — there is deliberately no call to Google Books, OpenLibrary, or any other book-metadata API. Earlier versions did this lookup; it was removed (commit `45e73e1`) after Google cut the keyless quota to zero, and because the lookup added failure modes without benefit to this workflow. The Google Sheet (if sync is enabled) is the system of record for title/author/etc. Manual entry (`modal-add-book`) mirrors this: it's ISBN-only too, using the ISBN as the placeholder `title` (see `handleAddManualBook` in `src/app.ts`) — it does not collect title/author/publisher/year.

Do not reintroduce a book-details API call as a "quick fix" — it was removed on purpose. If you see stale references to fetching book details elsewhere in the repo, that's docs/comments lagging behind this decision; fix the doc, not the code.

## Sync limitation (real, not a bug)

`sync.ts` POSTs with `mode: 'no-cors'` because Apps Script Web Apps don't return readable CORS responses. This means the app can only detect network-level send failures, never whether the Apps Script code actually wrote the row. Don't try to "fix" this by reading the response — it's opaque by design of Apps Script, not this codebase.

The payload is just `{ isbn }` — nothing else. The paired Apps Script code (documented in `README.md`'s "Google Sheet Sync" section) targets one specific tab by `gid` and writes the ISBN only into a single configured column (currently F), always at `getLastRow() + 1` — i.e. the next row where *every* column is empty, not just F — so it never overwrites existing data anywhere in the row. If you change what BookScan syncs, the Apps Script snippet in `README.md` needs a matching update — they're two halves of one contract.
