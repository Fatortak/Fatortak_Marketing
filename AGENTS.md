# Notes for coding agents working in this repository

Two agents share this checkout (`main`). Read this before editing.

## Ownership

- **Portal (`portal/server.mjs`, `portal/adapters.mjs`, `portal/public/*`, tests):** free to edit again.
  Claude Code finished its work in commits `8db06b4`, `a932f32` and the commit that added this note.
  Run `npm test` in `portal/` before committing portal changes.
- Content, queue builders (`portal/scripts/*`), landing assets and deployment: free to change.

## Rules for both agents

- Commit small and often on `main`; never rewrite or force-push history.
- Before editing a file, run `git status` and `git diff <file>`; do not overwrite someone else's
  uncommitted work.
- Production publishes for real. Never call live platform APIs from tests; use dry run.
- **Never point a test or local server at the real credentials.** `portal/.env` holds production
  tokens. Tests set `PORTAL_ENV_FILE` to a temp file and `PORTAL_ISOLATED=1`; keep it that way.

## What changed in the portal (for deploy)

- New data in `portal.json` (created automatically on load): `automations`, `automationRuns`,
  `trash`, `metricsHistory`, `settings.channelRules`, per-post `overrides`, `metrics`, `automationRuns`.
- Deploy copies `server.mjs`, `adapters.mjs` and `public/*` as before; no new files are needed at runtime.
- Asset cache keys bumped to `?v=20261104-3`.
- Nothing changes in production behaviour until someone turns it on: no channel rules and no
  automations exist by default. Deleting now moves posts to Trash.

## Requests for the content agent

From a content audit of the 12/day queue (`build-daily-10.mjs`), score 42/100:

1. **Volume per channel.** Every post goes to all six channels, so Facebook, Instagram and LinkedIn get
   12 posts/day (platform guidance: Facebook/Instagram ~2, LinkedIn ~1). Either target those three
   channels on 1–2 chosen slots per day in the builder, or let the user apply recommended daily caps
   in Connections. If caps are used, tag the daily video posts `priority` so they are never capped.
2. **Repetition.** 360 posts use ~60–70 distinct messages; 55 repeat within 3 days. Add new angles
   or space repeats ≥ 7 days apart.
3. **Instagram captions** contain `{{site}}` links that can't be clicked. Turn on the Instagram
   "link in bio" rule, or write Instagram `overrides` without links.
4. **Hashtags:** none on Instagram/LinkedIn. Use channel rules (3–5 tags) or add them per post.
5. **Engagement prompts:** only 10/360 posts ask a question. Aim for ~1 in 5.
6. **Pillar mix:** 46% product, no insight posts. Add insight/tip/use-case posts.
7. Tag offers with `offer` and launches with `launch` so the automation recipes can pick them up.

## Requests

(none)
