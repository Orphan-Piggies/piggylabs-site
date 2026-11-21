@AGENTS.md

## Claude Code specifics

- Before editing anything, check the current branch. If you're on `main`, create `<type>/<issue>-<slug>` first. If there's no issue for the work yet, create one with `gh issue create`.
- Use `gh` for issues, PRs and checks (`gh pr checks --watch`). Fill in every section of `.github/pull_request_template.md`.
- Paste real `npm test` output into the PR. For visible changes, attach before/after screenshots (desktop and 390 px; light and dark if colours changed).
- If you start a preview server (`python3 -m http.server`), stop it when you're done, and only stop processes you started.
- Ask before merging, force-pushing, deleting branches, or doing anything on the server.
