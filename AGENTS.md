# AGENTS.md

Guidance for AI coding agents (and humans) working on the piggylabs.io site. See `README.md` for how it's published.

## What this repo is

A plain static website: HTML, CSS and SVG in `site/`, served by Caddy on one DigitalOcean droplet. There is no build step, framework, bundler or JavaScript, and none should be added without a clear reason agreed in an issue first.

**Merging to `main` publishes the site.** Within about 2 minutes the droplet fetches `main` and serves `site/` from that commit. Treat every merge as a release.

## Non-negotiable rules

1. **Issue → branch → PR → merge.** Never push to `main` directly. Branch names: `<type>/<issue>-<slug>`, for example `feat/3-projects-page` or `fix/7-broken-link` (`feat`, `fix`, `docs`, `chore`, `test`).
2. **A human merges.** Agents open the PR and say it's ready. They don't merge, force-push or delete branches without being asked.
3. **Tests pass before a PR, with real output.** Run `npm test` and paste the actual result into the PR. Never claim a check passed if you didn't run it.
4. **Screenshots for visible changes.** Before and after, desktop and phone width (390 px), in both light and dark mode when colours change. See "Checking your change" below.
5. **Keep the Content-Security-Policy intact.** The site sends `default-src 'self'` with `script-src 'self'` and `style-src 'self'` (`deploy/Caddyfile`). So:
   - no inline `<script>` blocks or `on…=` handlers;
   - no `<style>` blocks and no `style=` attributes;
   - nothing loaded from other sites: no CDNs, web fonts, analytics or embeds.

   Put CSS in `site/style.css`, and any script in a `.js` file under `site/`. The tests check this.
6. **No secrets, ever.** This repo is public. Never commit keys, tokens, passwords, server access details or personal data.
7. **One issue per PR.** If you find something else, open a new issue for it.

## Commands

```sh
npm test                                  # all checks (Node 22+, no dependencies to install)
python3 -m http.server -d site 8080       # preview at http://localhost:8080
docker run --rm -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

CI (`.github/workflows/ci.yml`) runs the tests and the Caddyfile check on every PR and on `main`.

## Map

| Path | What it is |
|---|---|
| `site/index.html` | The front page |
| `site/404.html` | Shown for any unknown path. It links assets with absolute paths (`/style.css`), because it's served at any URL |
| `site/style.css` | All styles. Colours are CSS variables on `:root`, with a dark version under `prefers-color-scheme: dark` |
| `site/favicon.svg` | Logo and favicon |
| `deploy/update.sh` | What the droplet runs every 2 minutes: fetch `main`, unpack `site/` into `releases/<commit>`, switch the `current` symlink |
| `deploy/piggylabs-update.{service,timer}` | The systemd units that run it, as the `piggylabs-deploy` user (no login, no sudo) |
| `deploy/Caddyfile` | HTTPS, the `www` redirect, the 404 page, security headers and caching |
| `test/site.test.js` | Links resolve, the CSP-safe rules, the deploy files agree, and `update.sh` behaves |

## Conventions

- **HTML:** semantic elements (`header`, `main`, `section`, `article`, `footer`), one `h1` per page, and `alt` on images (empty `alt=""` when decorative). Links within the site are relative (`style.css`, `#projects`), except in `404.html`.
- **CSS:** add colours as variables on `:root` and give each one a dark-mode value. Lay out with flex and grid, and check the page at 390 px wide with no horizontal scrolling. Keep the existing spacing and type scale rather than adding one-off sizes.
- **Copy:** plain, friendly, short sentences. Don't promise things that aren't true: for example, the game projects' code isn't public, so don't say it is.
- **New pages:** add `site/<name>.html` (served at `/<name>.html`), link it from the front page, and reuse `style.css`. The link test covers new pages automatically.
- **Assets:** prefer SVG; compress images, and keep any single image under ~300 KB. Everything lives under `site/`.
- **Dependencies:** avoid them. If one is truly needed, explain why in the PR.

## Checking your change

1. Run `npm test`, which must pass.
2. Preview it with `python3 -m http.server -d site 8080`.
3. Take screenshots with any browser tool, or headless Chrome:
   ```sh
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=1280,900 --screenshot=desktop.png http://localhost:8080/
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=390,844 --screenshot=phone.png http://localhost:8080/
   ```
   Drag the images into the PR description.
4. After merging, the live site updates within about 2 minutes. Check it at https://piggylabs.io. Browsers may cache HTML for a moment, so reload.

## Changing the deploy files

`deploy/` changes affect the live server, so take extra care:

- **`update.sh`:** the clone on the droplet follows `main`, so the next run picks up a merged change by itself. Keep it safe to run repeatedly, and keep the test in `test/site.test.js` up to date.
- **`Caddyfile` and the systemd units:** these are **copied by hand** onto the server (see `README.md`). Merging doesn't apply them. Say so in the PR, so the person with server access installs them.
- **Never weaken the security headers** without an issue explaining why.
- **The server also hosts the LanSlither game** (paused for now). Its Caddy site block goes *next to* this one in the same `/etc/caddy/Caddyfile`. Never write a change that would remove it.

## Server access

Agents don't need server access to work on the site: merging publishes it. Only touch the droplet if a maintainer explicitly asks, with the access they give you, and stop and report at the first sign of trouble instead of improvising.
