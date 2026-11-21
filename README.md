# piggylabs.io

The front page of [piggylabs.io](https://piggylabs.io): a plain static site (`site/`) with no build step.

Working on it, or pointing an AI agent at it? Read [`AGENTS.md`](AGENTS.md) first.

## Changing the site

Edit the files in `site/` and open a pull request. CI checks that every link points at a real file, that nothing would break the Content-Security-Policy (no inline scripts, handlers or styles), and that the deploy files agree with each other.

```sh
npm test                     # same checks as CI (Node 22+)
python3 -m http.server -d site 8080   # preview at http://localhost:8080
```

**Merging to `main` publishes it.** Within about 2 minutes the droplet picks up the new commit. Nothing else is needed.

## How it's published

```
GitHub main ──(every 2 min, piggylabs-update.timer)──▶ /opt/piggylabs/repo          clone of this public repo
                                                      /opt/piggylabs/releases/<commit>/   site/ of each commit
                                                      /opt/piggylabs/releases/current ─▶ the live one
Caddy (HTTPS, piggylabs.io) ──serves──▶ /opt/piggylabs/releases/current
```

- [`deploy/update.sh`](deploy/update.sh) runs as `piggylabs-deploy`, which has no login and no sudo. It fetches `main`, unpacks `site/` into a folder named after the commit, and points the `current` symlink at it in one step. A commit without `site/index.html` is refused and the live site stays as it is. The newest 5 releases are kept.
- Caddy reads the files directly, so publishing needs no restart and no privileges.
- **Roll back:** revert the commit on `main`. In a hurry, point `current` at an older folder: `sudo -u piggylabs-deploy ln -sfn /opt/piggylabs/releases/<commit> /opt/piggylabs/releases/current`. The next new commit moves it forward again.
- **Logs:** `journalctl -u piggylabs-update`

## Setting up a server (once, as root)

```sh
useradd --system --create-home --home-dir /home/piggylabs-deploy --shell /usr/sbin/nologin piggylabs-deploy
install -d -o piggylabs-deploy -g piggylabs-deploy -m 755 /opt/piggylabs /opt/piggylabs/releases
sudo -u piggylabs-deploy git clone https://github.com/Orphan-Piggies/piggylabs-site.git /opt/piggylabs/repo
sudo -u piggylabs-deploy /opt/piggylabs/repo/deploy/update.sh          # first publish

cp /opt/piggylabs/repo/deploy/piggylabs-update.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now piggylabs-update.timer

# Caddy (official apt repository), then:
cp /opt/piggylabs/repo/deploy/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

DNS: an `A` record for `piggylabs.io`, and `www` as a CNAME to it, pointing at the server. Caddy gets the HTTPS certificates by itself on the first request.

**One Caddyfile per server.** If Soxulcan runs on the same server again, add its site block (from the LanSlither repository's `deploy/Caddyfile`) to `/etc/caddy/Caddyfile` next to this one; don't replace it.
