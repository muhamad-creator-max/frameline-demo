# Loophole / Frameline — Full Webapp Glitch Report

**Date:** 2026-07-18
**Scope:** Full source audit of the SaaS webapp
**App:** "Frameline" (repo name `loophole`) — Frame.io-style video/media review + creative-guideline SaaS
**Stack:** Next.js 15.5.18 · React 19 · TypeScript 5.7 · Supabase (SSR) · Mux · Konva · Stripe · Tailwind/Radix

---

## How this was checked

| Check | Result |
|-------|--------|
| `tsc --noEmit` (typecheck) | **23 errors** across 12 files |
| `next lint` | **1 warning** (exhaustive-deps) |
| `next build` | **Passes** — but only because `next.config.ts` sets `ignoreBuildErrors: true` **and** `ignoreDuringBuilds: true` |
| Manual code read (React/async, media/annotation, UI/error-handling) | 20+ findings, key ones verified below |

**Headline:** The app builds and ships today only because TypeScript and ESLint errors are *suppressed* at build time. The 23 type errors are real and known (documented in `next.config.ts`). None are cosmetic-only; several mask genuine runtime risks.

---

## 🔴 Critical / High

### 1. 23 TypeScript errors are suppressed, not fixed
`next.config.ts:10-11` disables `ignoreBuildErrors` and `ignoreDuringBuilds`. The comment says this is "TEMPORARY (demo deploy)". Consequences: any *new* type error (including a real bug) will also be silently swallowed by the build. Representative errors:
- `src/app/app/trash/page.tsx` (5 errors) — query typed as `SelectQueryError<"column 'deleted_at' does not exist on 'responses'">`. This strongly implies the **trash feature queries a `deleted_at` column that the DB schema/types don't have** — soft-delete may be broken, not just mistyped.
- `src/app/api/responses/[id]/trash/route.ts` (3) — writes `deleted_at` that "does not exist in type". Same root cause; **trashing a response may fail at runtime.**
- `src/app/api/webhooks/mux/route.ts` (2) & `webhooks/stripe/route.ts` (1) — `Object literal may only specify known properties, 'id' does not exist in type 'never[]'`. Webhook handlers are typed against `never` — Supabase types are stale (`database.types.ts` is a hand-maintained placeholder).
- `src/lib/stripe/client.ts:13` — pinned Stripe `apiVersion: "2024-12-18.acacia"` doesn't match the SDK's expected `"2025-02-24.acacia"`.

**Root cause:** `src/lib/supabase/database.types.ts` is a placeholder and out of sync with `supabase/migrations/`. **Fix:** run `npm run db:types` against the real project, then remove both `ignore*` flags and resolve what surfaces.

### 2. Answer submission can silently lose data (client flow)
`src/components/client-flow/question-runner.tsx:106-125` — `persistCurrent()` does `await fetch(.../answer …)` with **no `.ok` check and no `.catch`**. It's called by `next()` at line 128 *before* advancing. If the POST fails (network/RLS/500), the respondent advances to the next question believing their answer was recorded — **silent data loss**. Also no in-flight lock, so the "Next" button (disabled only during final `submitting`, line ~187) can be double-clicked during the save.
**Fix:** check `res.ok`, surface a toast on failure, block advancing, and disable Next while persisting.

### 3. Rapid version switching can show comments from the wrong version (race)
`src/components/review/review-workspace.tsx:92-111` — version load uses a local `cancelled` flag, but there's no request-ordering guard. If version B's `loadComments` resolves before version A's slower in-flight request, A's late `.then()` overwrites B's comments → **stale comments displayed against the wrong video version.**
**Fix:** compare a monotonic `versionLoadId` inside `.then()` (ignore any response that isn't the latest), or use `AbortController`.

### 4. Comment/annotation list swallows Supabase errors → empty list instead of error
`src/app/api/review/comments/list/route.ts:20-22` — destructures `{ data: comments }` / `{ data: annotations }` from a `Promise.all` and **never checks `.error`**. On RLS/query failure, both are `undefined`, coalesced to `[]`, and the API returns an **empty comment tree** — indistinguishable from "no comments." Reviewers think feedback was lost.
**Fix:** check both `.error`s and return a 500 (or surface the failure) instead of an empty success.

### 5. Upload status polling can hang or crash
`src/lib/review/use-upload.ts:94-96` — `await fetch(.../status…).then(r => r.json())` with **no `.ok` check**; polls a fixed `120 × 2.5s` (5 min) loop. On a 500 the `.json()` may throw or return an object with no `.status`, so either the loop crashes or spins to timeout with **no user feedback**. After 5 min it just stops silently.
**Fix:** guard `res.ok`, handle JSON errors, and show a terminal error state on timeout/failure.

### 6. Signed-URL generation failures are silent (private media may not load)
`src/lib/review/server.ts` (~lines 20, 287-289) — `createSignedUrl(...)` result isn't error-checked; on failure `data` is `null`, the code keeps the **unsigned** path, and private storage assets fail to load with no log/handling.
**Fix:** check `error`, log it, and mark the asset as unavailable rather than emitting a dead URL.

---

## 🟠 Medium

### 7. `onSubmitAnnotation` is dead code (annotations still save — but the prop is a landmine)
`src/components/review/video-stage.tsx:217` — `void onSubmitAnnotation;` and the prop (declared line 59, destructured line 79) is **never called.** ⚠️ **Note:** this does *not* break annotation saving. Annotations persist via the Zustand `drafts` store, which the comment composer reads and posts (`comment-composer.tsx:73-74`). So this is an **unused prop / dead wiring**, not a broken feature — but it's confusing and should be removed or actually used. *(Verified by reading both files.)*

### 8. Stale-closure timeline drag while duration changes
`video-stage.tsx` `AnnotateTimeline` effect (~lines 530-541) depends on `[dragging, onScrub, timeFromClientX]`. `timeFromClientX` closes over `duration`; if the version (and duration) changes mid-drag, scrub math can use a stale duration until pointer-up. Low frequency but real.

### 9. Keyboard nav uses stale `next`/`back` closures
`question-runner.tsx:152-161` — the `keydown` effect calls `next`/`back` but omits them from deps (with an `eslint-disable`). Arrow-key navigation can act on stale state after re-renders.
**Fix:** wrap `next`/`back` in `useCallback` and depend on them, or use a ref.

### 10. `useMemo` unstable dependency (the one lint warning)
`question-runner.tsx:85` — `draft` is built from a logical expression, changing the identity every render and defeating the `useMemo` at line 95. Wrap `draft` in its own `useMemo`.

### 11. Unsafe cast of annotation coordinates
`src/lib/review/server.ts:39` — `coordinates: (a.coordinates_json ?? {}) as AnnotationDTO["coordinates"]`. A `null`/malformed row becomes `{}` cast to a discriminated union, which `coordsToPixels()` later trusts. `coords.ts` guards most fields with `?? 0`, but `freehand` iterates `c.points` — a bad shape could still throw. Validate shape (or Zod-parse) before casting.

### 12. Share-link generation fails silently → "Generating link…" forever
`src/components/review/share-dialog.tsx:42-49` — the POST to create a share slug has `.catch(() => {})`. On failure the input stays on the `Generating link…` placeholder indefinitely with no error and no retry.
Related: `share-dialog.tsx:66` and `projects-list.tsx:35` throw `new Error()` with **no message**, so the resulting toast is generic ("Failed to …") and the real cause is lost.

---

## 🟡 Low / Polish

- **Empty `throw new Error()`** (no message) in several places — `review/projects-list.tsx:35`, `review/share-dialog.tsx:66`. Add a message so toasts are actionable.
- **Inputs not disabled during save** — `settings/profile-form.tsx` disables the button but not the fields (edits possible mid-save); `builder/share-dialog.tsx` password Save has a small double-submit window.
- **Fragile Mux "pending" heuristic** — `builder/media-picker.tsx:76` treats `mediaUrl.length > 40` as "still pending"; a longer playback ID would wrongly re-trigger polling.
- **`console.error` left in prod paths** — e.g. `review/review-workspace.tsx:105`, `builder/media-picker.tsx:178`, `api/uploads/mux/route.ts:53`. Namespaced but still shipped.
- **Empty alt text fallbacks** — `question-runner.tsx` (~862/882/979) use `alt={opt.label ?? ""}`; icon-only buttons in `video-stage.tsx` / `guideline-builder.tsx` lack `aria-label`.
- **i18n type mismatch** — `src/lib/i18n/provider.tsx:37`: the Arabic dictionary isn't assignable to the English dictionary's literal-typed shape (`"Loophole"` vs `"لوب‌هول"`). Widen the dictionary type so `ar` conforms.

---

## Recommended fix order

1. **Regenerate Supabase types** (`npm run db:types`) and **remove both `ignore*` flags** in `next.config.ts`. This exposes and lets you fix #1 and confirms whether **trash/soft-delete (`deleted_at`) actually works** (#1 trash + `api/responses/[id]/trash`).
2. **Client-flow answer persistence** (#2) — highest user-facing data-loss risk.
3. **Review data-integrity races/errors** (#3, #4, #5, #6) — these make the core review product look broken or empty.
4. Medium items (#7–#12), then polish.

## How to verify after fixes

- `npm run typecheck` → **0 errors** (with `ignoreBuildErrors` removed).
- `npm run lint` → **0 warnings**.
- `npm run build` → passes on merit, not suppression.
- **Manual E2E (dev server `npm run dev`):**
  - Client flow: answer a question with network throttled/offline → must show an error and NOT advance (#2).
  - Review: upload a video, switch versions rapidly → comments must always match the shown version (#3); kill the comments API → UI must show an error, not an empty thread (#4).
  - Trash: soft-delete a response, confirm it lands in `/app/trash` and can be restored/purged (#1 trash).
  - Share dialog: force the share endpoint to 500 → must show an error, not a permanent "Generating link…" (#12).
