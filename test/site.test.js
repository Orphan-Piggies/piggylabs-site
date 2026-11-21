'use strict';
// The site and its deploy files: every page links only files that exist, nothing breaks the Content-Security-Policy,
// and deploy/update.sh publishes main the way the droplet runs it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..'), SITE = path.join(ROOT, 'site');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));

test('the site has a front page and a 404 page', () => {
  assert.ok(pages.includes('index.html'));
  assert.ok(pages.includes('404.html'));
});

test('every local link and asset exists', () => {
  for (const p of pages) {
    for (const [, url] of read('site/' + p).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#)/.test(url) || url === '/') continue;
      const file = url.replace(/^\//, '').split(/[?#]/)[0];
      assert.ok(fs.existsSync(path.join(SITE, file)), `${p} links to ${url}, which isn't in site/`);
    }
  }
});

test('nothing the Content-Security-Policy would block: no inline scripts, handlers or styles', () => {
  for (const p of pages) {
    const html = read('site/' + p);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, `${p}: inline <script>`);
    assert.doesNotMatch(html, /\son[a-z]+=/i, `${p}: on…= handler`);
    assert.doesNotMatch(html, /\sstyle=|<style/i, `${p}: inline style`);
  }
});

test('Caddy serves what the updater publishes, and the units agree', () => {
  const caddy = read('deploy/Caddyfile'), script = read('deploy/update.sh'), svc = read('deploy/piggylabs-update.service');
  const releases = script.match(/RELEASES_DIR:-([^}]+)\}/)[1];
  assert.match(caddy, new RegExp(`root \\* ${releases}/current\\n`));
  assert.match(caddy, /^piggylabs\.io \{/m);
  assert.match(caddy, /redir https:\/\/piggylabs\.io\{uri\} permanent/);
  assert.match(svc, /^User=piggylabs-deploy$/m);
  assert.match(svc, new RegExp(`^ExecStart=${script.match(/REPO_DIR:-([^}]+)\}/)[1]}/deploy/update\\.sh$`, 'm'));
  assert.ok(fs.statSync(path.join(ROOT, 'deploy/update.sh')).mode & 0o111, 'update.sh must be executable');
});

test('update.sh publishes main, skips what is live, refuses a commit without index.html, and prunes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'piggylabs-')), origin = path.join(tmp, 'origin'), repo = path.join(tmp, 'repo'), rel = path.join(tmp, 'releases');
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const git = (cwd, ...a) => execFileSync('git', a, { cwd, env, stdio: 'pipe' }).toString().trim();
  const run = () => { try { return { code: 0, out: execFileSync('bash', [path.join(ROOT, 'deploy/update.sh')], { env: { ...env, REPO_DIR: repo, RELEASES_DIR: rel, KEEP_RELEASES: '2' }, stdio: 'pipe' }).toString() }; }
    catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
  const commit = (html) => {
    fs.mkdirSync(path.join(origin, 'site'), { recursive: true });
    if (html === null) fs.rmSync(path.join(origin, 'site/index.html'), { force: true }); else fs.writeFileSync(path.join(origin, 'site/index.html'), html);
    fs.writeFileSync(path.join(origin, 'site/n.txt'), String(Math.random()));
    git(origin, 'add', '-A'); git(origin, 'commit', '-qm', 'c'); return git(origin, 'rev-parse', '--short=12', 'HEAD');
  };
  const live = () => path.basename(fs.readlinkSync(path.join(rel, 'current')));
  try {
    fs.mkdirSync(origin); git(origin, 'init', '-q', '-b', 'main');
    const a = commit('<h1>one</h1>'); git(tmp, 'clone', '-q', origin, repo);
    let r = run(); assert.equal(r.code, 0, r.out);
    assert.equal(live(), a);
    assert.equal(fs.readFileSync(path.join(rel, 'current/index.html'), 'utf8'), '<h1>one</h1>', 'site/ is published at the root');
    assert.equal(run().out, '', 'nothing to do when main is already live');
    const b = commit('<h1>two</h1>'); r = run(); assert.equal(r.code, 0, r.out); assert.equal(live(), b);
    commit(null); r = run(); assert.equal(r.code, 1); assert.match(r.out, /no site\/index\.html/); assert.equal(live(), b, 'a broken commit changes nothing');
    const c = commit('<h1>three</h1>'); r = run(); assert.equal(r.code, 0, r.out); assert.equal(live(), c);
    const left = fs.readdirSync(rel).filter(f => f !== 'current' && !f.startsWith('.'));
    assert.ok(left.length <= 2 && left.includes(c), `kept ${left}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('AGENTS.md matches what the server actually enforces', () => {
  const agents = read('AGENTS.md'), caddy = read('deploy/Caddyfile');
  for (const rule of ["default-src 'self'", "script-src 'self'", "style-src 'self'"]) {
    assert.ok(caddy.includes(rule), `the Caddyfile no longer sends ${rule}`);
    assert.ok(agents.includes(rule), `AGENTS.md doesn't mention ${rule}`);
  }
  assert.match(read('CLAUDE.md'), /^@AGENTS\.md$/m, 'CLAUDE.md must import AGENTS.md');
  assert.ok(fs.existsSync(path.join(ROOT, '.github/pull_request_template.md')), 'AGENTS.md and CLAUDE.md refer to the PR template');
});
