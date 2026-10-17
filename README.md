# Margin

A private PDF annotation workspace. Visitors sign in with ChatGPT and arrive at a device-local project history. The server supplies authenticated session information and a prepared, authenticated AI drafting endpoint. PDF editing and handwriting rendering happen in the browser.

## Features

- History dashboard with search, style filters, thumbnails, rename, delete, and project reopening. IndexedDB retains the original PDF, annotations, styles, and editing state per signed-in account on the device. Summary records keep history browsing from loading every PDF into memory.
- New annotation flow: two large style choices, font/color/size and restrained variation controls, then worksheet upload.
- Actual PDF rendering, multiple pages, zoom, movable and resizable text boxes, region highlights, undo, and review-confirmed editable PDF export. Reopening an exported PDF in Margin restores the text boxes, styles, and handwriting used in that document.
- Digital notes and personal handwritten notes assembled from the user's drawn stroke samples.
- Six slots per character, deterministic mixed variants that avoid immediate repeats, with light spacing and baseline variation.
- Account-backed handwriting profiles with a browser copy, automatic migration of existing samples, version checks for concurrent changes, JSON backup/import, and an explicitly labeled starter style for missing characters.
- Letter heights and baselines are normalized at rendering time; original drawn samples remain untouched. Capitals, lowercase bodies, ascenders, and descenders retain natural proportions.
- Selectable extracted page text and reviewable local wording simplification. When an API connection is configured, the server supports source-based answer suggestions and AI wording revision. Suggestions display source support and remain editable before placement.

## Current boundaries

PDF projects remain device-local. Handwriting profiles use authenticated D1 storage, with a browser copy and three-way merging of changes. Existing browser samples migrate on the next signed-in visit to the same Site. Wait for “Saved to your account” before clearing browser storage. Site updates preserve the Site identity and database; deploying a separate Site is a separate data destination.

The OpenAI API is configured on the hosted Site and a live generation test completed successfully after API credits were added. A source textbook is optional: with no source, drafts use model knowledge and are labeled for verification. The local wording simplifier and manual editor remain usable without API credits. Scanned PDF text extraction requires OCR, which is not included. AI placement is an estimate requiring review. Exports preserve added notes as PDF annotations and embed editing data, including only the handwriting characters used in the document. Reopen the export in Margin to preserve personal handwriting during editing; other PDF editors may substitute a standard font when changing annotation text. Signature validation and interactive form editing are outside this version.

## Dependencies

Source frontend assets are under `web/`; `scripts/prepare-web.mjs` copies them to the public directory at build time. Vendored PDF.js and pdf-lib are under `web/assets`. Preserve their license files. The bundled font files are from the URW Base35 distribution and include its license. The Vinext starter's Sites integration is retained.

## Checks

Run `npm run check` and `pnpm exec tsc --noEmit`. Build with `pnpm build`. The tests cover character mixing, handwriting normalization, preserving all six samples during account migration, cloud restore, concurrent edits, offline preservation, request validation, rotated-PDF coordinates, and editable PDF export/reopening without duplicate notes. Native PDF rendering was checked at all four page rotations. Browser QA was unavailable in the authoring environment. Hosted migration of the user's actual browser alphabet requires their next visit; no personal samples are included in the source.

See `GITHUB_IMPORT.md` for moving the source to GitHub.
