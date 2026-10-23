// Shared helpers for the StoryRail scripts: the config, GitLab access with a token, and the run's applications.
// Plain Node (18+), no dependencies.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const config = JSON.parse(readFileSync(join(ROOT, 'storyrail.config.json'), 'utf8'));

export function fail(tool, msg, code = 2) {
  console.error(`${tool}: ${msg}`);
  process.exit(code);
}

const isTodo = (v) => v == null || String(v).startsWith('TODO');

// ---------- GitLab ----------

export function gitlab(tool) {
  const GL = config.gitlab ?? {};
  const base = String(GL.url ?? '').replace(/\/+$/, '');
  if (isTodo(base) || !base) fail(tool, 'set gitlab.url in storyrail.config.json (your GitLab address)');
  const tokenEnv = GL.tokenEnv ?? 'GITLAB_TOKEN';
  const token = process.env[tokenEnv];
  const needToken = () => {
    if (!token) fail(tool, `no token: set the ${tokenEnv} environment variable (a personal access token with scope api)`);
  };
  async function api(method, path, body) {
    needToken();
    const res = await fetch(`${base}/api/v4${path}`, {
      method,
      headers: { 'PRIVATE-TOKEN': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.message ? JSON.stringify(j.message) : j.error ?? text;
      } catch { /* not JSON */ }
      console.error(`${tool}: ${method} ${path} → HTTP ${res.status}: ${String(msg).slice(0, 300)}`);
      process.exit(1);
    }
    return text ? JSON.parse(text) : null;
  }
  async function raw(url) {
    needToken();
    return fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
  }
  return { base, api, raw, token, tokenEnv };
}

export const enc = (p) => encodeURIComponent(p);

// ---------- the run's applications (runs/issue-<N>/apps.json, written by storyrail-apps.mjs) ----------

export const runDir = (n) => join(ROOT, 'runs', `issue-${n}`);
export const appsFile = (n) => join(runDir(n), 'apps.json');

export function readApps(n) {
  const f = appsFile(n);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/** The newest apps.json in runs/ (the run in progress). */
export function latestApps() {
  const dir = join(ROOT, 'runs');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .map((d) => join(dir, d, 'apps.json'))
    .filter((f) => existsSync(f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files.length ? JSON.parse(readFileSync(files[0], 'utf8')) : null;
}

/** A GitLab project path for: backlog, hub, an app id of the run in progress, or a project path itself. */
export function projectFor(tool, key) {
  if (key === 'backlog') return checked(tool, key, config.backlog?.project);
  if (key === 'hub') return checked(tool, key, config.hub?.project);
  if (key.includes('/')) return key;
  const app = latestApps()?.apps?.find((a) => a.id.toLowerCase() === key.toLowerCase());
  if (app) return app.project;
  return fail(tool, `unknown repo "${key}": use backlog, hub, an application of the run (see runs/issue-<N>/apps.json) or a GitLab project path`);
}
function checked(tool, key, p) {
  if (isTodo(p)) fail(tool, `the GitLab project for "${key}" is still a TODO(office) placeholder in storyrail.config.json`);
  return p;
}

/** Default branch of an app of the run in progress (or main). */
export function defaultBranchFor(key) {
  const app = latestApps()?.apps?.find((a) => a.id.toLowerCase() === key.toLowerCase() || a.project === key);
  return app?.defaultBranch ?? (key === 'hub' ? config.hub?.defaultBranch : null) ?? 'main';
}
