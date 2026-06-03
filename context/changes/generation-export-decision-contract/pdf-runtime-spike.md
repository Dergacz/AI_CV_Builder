# PDF Runtime Spike

## Purpose

Record the compatibility evidence needed before S-07 chooses a final PDF export dependency. This spike does not implement PDF export and does not add production source files.

## Candidates Considered

| Candidate                                                                                     | Runtime class         | Current fit                                               | Notes                                                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@react-pdf/renderer` browser APIs such as `PDFDownloadLink` or `BlobProvider`                | Browser-side          | Preferred candidate for Phase 2 evidence                  | Keeps PDF creation out of Cloudflare Workers and can consume the structured draft shape through a React island.        |
| `@react-pdf/renderer` Node APIs such as `renderToFile`, `renderToBuffer`, or `renderToStream` | Node-only server-side | Not accepted as Workers proof                             | Current docs describe these APIs for Node.js server rendering and examples use filesystem/streams.                     |
| Workers-compatible pure JavaScript PDF generation                                             | Workers-side          | Acceptable only if proven in a deployed Worker or preview | Could keep export server-side, but must avoid native binaries, filesystem, Chromium, and unsupported Node assumptions. |
| Browser `window.print()` / print stylesheet                                                   | Browser-side          | Fallback candidate for visual MVP only                    | Low dependency risk, but download naming, repeatability, and mobile UX need careful QA.                                |
| External PDF service                                                                          | External service      | Fallback only                                             | Use only if browser or Workers-compatible rendering fails quality, browser support, or synchronous runtime behavior.   |

## Validation Performed In This Phase

- Compared candidates against the F-01 contract and existing Cloudflare Workers runtime constraints.
- Confirmed the repo currently has no PDF dependency in `package.json`.
- Confirmed `wrangler.jsonc` deploys the app to Cloudflare Workers with `nodejs_compat`, but the contract still treats package compatibility as dependency-specific.
- Confirmed the contract fixture is structured JSON, so export should consume app-owned data rather than arbitrary model HTML.

## Recommendation

For the MVP, S-07 should start with a browser-side PDF renderer path, using the structured CV draft as input and a React island for download/error state. `@react-pdf/renderer` browser APIs are the first candidate to validate because they avoid server-side Workers PDF rendering while keeping a component-style document model.

S-07 should not use Node-only PDF APIs as proof of compatibility with Cloudflare Workers. If a server-side export route is required, it must be validated in a deployed Worker or Worker preview before it becomes the chosen path.

## Remaining Validation For S-07

S-07 must still validate:

- generated PDF readability in the one MVP template,
- desktop and mobile behavior in modern Chrome, Safari, Firefox, and Edge,
- failure UI for browser-side PDF generation errors,
- whether the selected library adds acceptable bundle/runtime cost,
- whether exported English, Polish, and Russian text render correctly with selected fonts,
- whether the same structured draft shape can be exported after manual section edits.

## Fallback Trigger

Switch to an external PDF service only if the browser-side or Workers-compatible path fails one of these criteria:

- cannot produce a clean, readable CV from the single template,
- cannot support modern target browsers,
- cannot handle English, Polish, and Russian text reliably,
- requires unsupported Workers APIs, native binaries, filesystem access, or Chromium in the Worker runtime,
- creates unacceptable synchronous runtime behavior for the MVP.

If the fallback trigger fires, open a new decision or implementation slice rather than expanding F-01 into a broader infrastructure change.

## Non-Decisions

- This spike does not choose a final PDF package version.
- This spike does not add a route, UI button, React PDF document component, dependency, or export QA fixture.
- This spike does not decide persistence of exported PDF files; the MVP exports on demand unless a later persistence slice changes that.
