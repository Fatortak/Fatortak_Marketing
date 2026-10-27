# Contributor growth

Stars are a lagging indicator. Contributions come from a repo that is easy to understand, easy to run, and pleasant to contribute to.

## The contributor ladder

| Stage | What they need | What you provide |
| --- | --- | --- |
| Visitor | A reason to care | Clear README, screenshots, live demo |
| User | A working install | Docker Compose, seed data, docs |
| Reporter | A way to report without friction | Issue templates, fast triage |
| First-time contributor | A small, well-scoped task | `good first issue`, setup guide, mentor |
| Repeat contributor | Ownership and recognition | Module ownership, roadmap input, credit |
| Maintainer | Trust and authority | Review rights, release access, a say in direction |

## First 10 good first issues

These are real, useful tasks. Create them as GitHub issues with context, acceptance criteria and file pointers.

1. **Add a demo seed dataset** — a fictional MENA agency with customers, invoices, expenses and a project. No real data. Acceptance: `dotnet run` with `SeedDemo=true` creates it.
2. **Add invoice total tests** — xUnit project covering line totals, discounts, VAT and rounding. Include edge cases: zero, 100% discount, multiple lines, rounding at 0.005.
3. **Add installment schedule tests** — equal splits, remainder handling, early payment, overdue status.
4. **Add a `/health` endpoint** — returns DB connectivity and app version. No auth. Used by Docker and load balancers.
5. **Make CORS configurable** — replace `AllowAll` in production with a configured origin list. Document in `docs/self-hosting.md`.
6. **Add a Postman/Bruno collection** — auth, create customer, create invoice, record payment, get P&L. Export JSON into `docs/api/`.
7. **Audit Arabic translation keys** — script that compares `en/translation.json` and `ar/translation.json`, reports missing/unused keys. Add to CI.
8. **Improve login/register accessibility** — labels, focus states, error announcements, keyboard navigation. Test with a screen reader.
9. **Add a `Makefile` or `Taskfile`** — `make dev`, `make api`, `make web`, `make test`, `make docker`. Document in CONTRIBUTING.
10. **Write the first migration guide** — "From Excel to Fatortak": customers, suppliers, opening balances, chart of accounts. This is also a lead magnet.

### Issue format

```markdown
## Context
Why this matters and who it helps.

## What to build
A clear scope. One outcome.

## Acceptance criteria
- [ ] ...
- [ ] ...

## Where to start
- `path/to/file.cs`
- `path/to/component.tsx`
- Related docs

## How to test
Commands and expected result.

## Out of scope
What not to change in this PR.

## Mentor
@maintainer — ask questions here, not in DMs.
```

A good first issue should take **2–6 hours**, not 2 weeks.

## Labels

| Label | Meaning |
| --- | --- |
| `good first issue` | Scoped, mentored, no deep codebase knowledge required |
| `help wanted` | Maintainers want a contributor, not necessarily first-time |
| `documentation` | Docs, guides, README, API examples |
| `translation` | Arabic/English copy and RTL |
| `bug` | Confirmed defect |
| `enhancement` | New capability |
| `needs reproduction` | Cannot reproduce yet |
| `needs design` | Requires a mockup or UX decision |
| `breaking change` | Needs a migration note |
| `growth` | Marketing/metrics automation, not product code |

Rules:

- Every issue gets exactly one type label and one area label.
- `good first issue` is a promise: the maintainer will respond within 2 business days.
- Remove `good first issue` if the issue turns out to be complex. Do not bait contributors.

## Onboarding flow

1. **First issue comment** — GitHub Action welcomes them and links CONTRIBUTING, setup and the issue.
2. **First PR** — a maintainer replies within 2 business days with either a review or a clear question.
3. **First merge** — thank them by name, add them to `CONTRIBUTORS.md`, and suggest a next issue.
4. **Second contribution** — invite them to a module or a recurring role.
5. **Sustained contribution** — offer review rights, a roadmap call, or swag.

## Review SLA

| Event | Target |
| --- | --- |
| New issue first response | 2 business days |
| PR first review | 3 business days |
| PR merge or clear next step | 7 business days |
| Security report acknowledgement | 72 hours |
| Release with contributor credit | Every 2 weeks |

If you cannot meet the SLA, say so in the issue. Silence is what kills contributor retention.

## Recognition

- `CONTRIBUTORS.md` grouped by contribution type.
- Release notes: "Thanks to @x for ...".
- README "Contributors" section with avatars (shields.io or contrib.rocks).
- Swag for the first 20 contributors (stickers, shirt) — budget it.
- LinkedIn recommendation or a public thank-you post for sustained contributors.
- Invite top contributors to a quarterly roadmap call.
- Offer a paid bounty for large, well-scoped features when there is budget.

## Programs

- **Hacktoberfest (October):** label issues, prepare a beginner path, review fast. Do not spam labels.
- **University partnerships (Egypt/MENA):** guest lecture, capstone projects, internships. Graduates need portfolio projects; you need docs and tests.
- **Local developer communities:** Cairo, Alexandria, Riyadh, Dubai meetups. Offer a 15-minute architecture talk, not a sales pitch.
- **Bounties:** IssueHunt, Algora or direct. Only for scoped work with a written acceptance criteria. Pay on merge.
- **Google Summer of Code / Outreachy:** only apply if you can mentor properly. A bad mentor experience is worse than not participating.

## Metrics

| Metric | Why | Target |
| --- | --- | --- |
| New contributors / month | Pipeline health | 3–5 |
| First PR merge time | Onboarding friction | < 7 days |
| Issue first response | Trust | < 2 days |
| PR review time | Respect for time | < 3 days |
| Contributor retention (2+ PRs) | Real community | 30% |
| Docs coverage of modules | Self-service | 80% |
| `good first issue` open count | Contribution capacity | 8–15 |

## What not to do

- Do not label hard tasks as `good first issue` to attract attention.
- Do not let PRs rot. Close with a reason if you will not merge.
- Do not rewrite a contributor's PR silently; ask them to make the change, or explain why you are taking it over.
- Do not ask for a CLA that assigns copyright if you can use a clear license grant instead (see CONTRIBUTING).
- Do not use contributors as free labor for a roadmap you never share.
- Do not celebrate stars while ignoring unanswered issues.
