#!/usr/bin/env node
// StoryRail applications: which apps a story touches, where they are, and in which order they depend on each other.
// Everything comes from the GitLab story and from GitLab itself, so a developer configures nothing per application.
//
// Usage (from the hub root):
//   node scripts/storyrail-apps.mjs discover <N> [--issue <iid>] [--apps "<id>,<id>>calls-id,..."]
//        Reads the "## Applications" section of issue <iid> (default N), finds each app in the GitLab group
//        (storyrail.config.json → gitlab.group, or apps.map for names that don't match), detects frontend/backend,
//        clones or updates it into projects/<type>/<id>, finds its API contract, UI tests and API tests, works out
//        the dependency order and writes runs/issue-<N>/apps.json. --apps replaces the issue's section
//        ("INSU-fa01>INSU-ta01" = INSU-fa01 calls INSU-ta01).
//   node scripts/storyrail-apps.mjs show <N>              the apps of run N, in dependency order
//   node scripts/storyrail-apps.mjs order <N>             their ids, providers first (the merge order)
//   node scripts/storyrail-apps.mjs sync <N>              put every app of run N on an up-to-date default branch
//   node scripts/storyrail-apps.mjs branch <N> <branch>   create (or switch to) <branch> in every app of run N
//   node scripts/storyrail-apps.mjs status <N>            branch, clean/dirty and last commit of every app
//
// Exit code 0 = ok, 1 = something needs a person (an app not found, ambiguous, a cycle…), 2 = usage error.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { ROOT, config, fail as failWith, gitlab, enc, readApps, appsFile } from './lib/storyrail.mjs';

const TOOL = 'storyrail-apps';
const fail = (msg, code) => failWith(TOOL, msg, code);
const need = (msg) => {
  console.error(`${TOOL}: ${msg}`);
  process.exit(1);
};

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const opt = (args, name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

// ---------- the story's Applications section ----------

/** [{ id, description, mentions[] }] from a "## Applications" section (bullets starting with the app name). */
function parseSection(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s*applications?\b/i.test(l.trim()));
  if (start < 0) return null;
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line.trim())) break;
    const m = /^\s*[-*]\s+(?:\[[ xX]\]\s*)?[`*_]*([A-Za-z0-9][A-Za-z0-9._-]*)[`*_]*\s*(.*)$/.exec(line);
    if (!m) continue;
    const rest = m[2].trim();
    const labelled = /^\(([^)]*)\)\s*[:\-–—]?\s*(.*)$/.exec(rest);
    out.push({ id: m[1], label: labelled ? labelled[1].trim() : '', description: (labelled ? labelled[2] : rest.replace(/^[:\-–—]\s*/, '')).trim() });
  }
  return out;
}

/** "a,b>a,c>b" → [{id, calls[]}] */
function parseOverride(spec) {
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [id, ...calls] = s.split('>').map((x) => x.trim());
    return { id, description: calls.length ? `calls ${calls.join(', ')}` : '', calls };
  });
}

// ---------- GitLab lookups ----------

async function findProject(api, id) {
  const map = config.apps?.map?.[id];
  const mapped = typeof map === 'string' ? map : map?.project;
  if (mapped) return { project: await api('GET', `/projects/${enc(mapped)}`), type: map?.type };
  const group = config.gitlab?.group;
  if (!group || String(group).startsWith('TODO')) {
    need(`can't look up ${id}: set gitlab.group in storyrail.config.json (or add "${id}": "group/project" to apps.map)`);
  }
  const found = await api('GET', `/groups/${enc(group)}/projects?search=${enc(id)}&include_subgroups=true&per_page=50&archived=false`);
  const low = id.toLowerCase();
  const exact = found.filter((p) => p.path.toLowerCase() === low || p.name.toLowerCase() === low);
  const prefixed = found.filter((p) => p.path.toLowerCase().startsWith(`${low}-`) || p.name.toLowerCase().startsWith(`${low}-`) || p.name.toLowerCase().startsWith(`${low} `));
  const pick = exact.length === 1 ? exact : exact.length ? exact : prefixed;
  if (pick.length === 1) return { project: pick[0] };
  if (!pick.length) need(`no GitLab project for ${id} in group ${group}${found.length ? ` (close: ${found.map((p) => p.path_with_namespace).join(', ')})` : ''}. Add "${id}": "group/project" to apps.map in storyrail.config.json.`);
  need(`${id} matches several GitLab projects: ${pick.map((p) => p.path_with_namespace).join(', ')}. Add "${id}": "group/project" to apps.map in storyrail.config.json.`);
}

async function detectType(api, project) {
  const tree = await api('GET', `/projects/${project.id}/repository/tree?per_page=100&ref=${enc(project.default_branch)}`);
  const names = new Set(tree.map((t) => t.name));
  const java = names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts');
  const node = names.has('package.json');
  if (java && !node) return 'backend';
  if (node && !java) return 'frontend';
  if (node && java) {
    try {
      const pkg = await api('GET', `/projects/${project.id}/repository/files/package.json?ref=${enc(project.default_branch)}`);
      const json = JSON.parse(Buffer.from(pkg.content, 'base64').toString('utf8'));
      const deps = { ...json.dependencies, ...json.devDependencies };
      if (['react', '@angular/core', 'vue', 'next', 'svelte'].some((d) => d in deps)) return 'frontend';
    } catch { /* unreadable: fall through */ }
    return 'backend';
  }
  return null;
}

// ---------- local detection in a clone ----------

const SKIP = new Set(['node_modules', '.git', 'target', 'build', 'dist', 'coverage', '.idea', 'playwright-report', 'test-results']);
function walk(dir, found = [], depth = 0) {
  if (depth > 8) return found;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, found, depth + 1);
    else found.push(p);
  }
  return found;
}
function apiTitle(file) {
  try {
    const head = readFileSync(file, 'utf8').split('\n').slice(0, 60).join('\n');
    const m = /^\s{2,}title:\s*["']?(.+?)["']?\s*$/m.exec(head) ?? /"title"\s*:\s*"([^"]+)"/.exec(head);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}
function inspect(dir) {
  const files = walk(dir).map((f) => relative(dir, f).split(sep).join('/'));
  const contracts = files.filter((f) => /(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(f.split('/').pop())).map((path) => ({ path, title: apiTitle(join(dir, path)) }));
  const pw = files.find((f) => /(^|\/)playwright\.config\.(ts|js|mjs|cjs)$/.test(f));
  const features = files.filter((f) => f.endsWith('.feature'));
  let apiTests = null;
  if (features.length) {
    const parts = features.map((f) => f.split('/').slice(0, -1));
    const common = parts.reduce((a, b) => a.slice(0, a.findIndex((x, i) => x !== b[i]) < 0 ? a.length : a.findIndex((x, i) => x !== b[i])));
    apiTests = common.join('/') || '.';
  }
  return { contracts, uiTests: pw ? dirname(pw) : null, apiTests, features: features.length };
}

function cloneOrUpdate(app) {
  const dir = join(ROOT, app.path);
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(dirname(dir), { recursive: true });
    execFileSync('git', ['clone', '--quiet', '--branch', app.defaultBranch, app.cloneUrl, dir], { stdio: 'inherit' });
    return 'cloned';
  }
  if (git(dir, 'status', '--porcelain')) need(`${app.path} has uncommitted changes; commit, stash or discard them first`);
  git(dir, 'fetch', '--quiet', 'origin');
  git(dir, 'switch', '--quiet', app.defaultBranch);
  git(dir, 'pull', '--quiet', '--ff-only');
  return 'updated';
}

/** Providers first; null on a cycle. */
function topo(apps) {
  const ids = new Set(apps.map((a) => a.id));
  const done = [];
  const seen = new Set();
  const temp = new Set();
  const visit = (a) => {
    if (seen.has(a.id)) return true;
    if (temp.has(a.id)) return false;
    temp.add(a.id);
    for (const c of a.consumes.filter((x) => ids.has(x))) if (!visit(apps.find((x) => x.id === c))) return false;
    temp.delete(a.id);
    seen.add(a.id);
    done.push(a.id);
    return true;
  };
  for (const a of apps) if (!visit(a)) return null;
  return done;
}

function table(data) {
  const lines = [`Applications of run ${data.issue} (dependency order: ${data.order.join(' → ')})`];
  for (const id of data.order) {
    const a = data.apps.find((x) => x.id === id);
    lines.push(`- ${a.id}${a.label ? ` (${a.label})` : ''} · ${a.type} · ${a.project} · ${a.path}`);
    if (a.consumes.length) lines.push(`    calls: ${a.consumes.join(', ')}`);
    if (a.consumesOutside.length) lines.push(`    calls (not changed in this story): ${a.consumesOutside.join(', ')}`);
    lines.push(`    contract: ${a.contract ?? 'none found'}${a.contractCopies.length ? ` · copies: ${a.contractCopies.map((c) => `${c.path} (of ${c.of})`).join(', ')}` : ''}`);
    if (a.type === 'frontend') lines.push(`    UI tests: ${a.uiTests ?? 'none found'}`);
    if (a.type === 'backend') lines.push(`    API tests: ${a.apiTests ?? 'none found'}`);
    if (a.description) lines.push(`    story: ${a.description}`);
  }
  return lines.join('\n');
}

const [cmd, n, ...args] = process.argv.slice(2);
if (cmd && cmd !== 'help' && !n) fail(`${cmd} needs the run number N (runs/issue-<N>)`);

switch (cmd) {
  case 'discover': {
    const { api } = gitlab(TOOL);
    const iid = opt(args, '--issue') ?? n;
    let listed;
    if (opt(args, '--apps')) listed = parseOverride(opt(args, '--apps'));
    else {
      const backlog = config.backlog?.project;
      if (!backlog || String(backlog).startsWith('TODO')) fail('set backlog.project in storyrail.config.json');
      const issue = await api('GET', `/projects/${enc(backlog)}/issues/${iid}`);
      listed = parseSection(issue.description);
      if (!listed?.length) need(`issue #${iid} has no "## Applications" section. Name the apps with --apps "<id>,<id>><called id>,…"`);
    }
    const ids = listed.map((a) => a.id);
    const apps = [];
    for (const item of listed) {
      const { project, type: forced } = await findProject(api, item.id);
      const type = forced ?? (await detectType(api, project));
      if (!type) need(`can't tell whether ${item.id} (${project.path_with_namespace}) is a frontend or a backend; add { "project": "${project.path_with_namespace}", "type": "frontend|backend" } to apps.map`);
      const mentioned = (item.calls ?? []).length
        ? item.calls
        : [...new Set([...item.description.matchAll(/[A-Za-z0-9][A-Za-z0-9._-]*/g)].map((m) => m[0]))].filter((w) => w.toLowerCase() !== item.id.toLowerCase() && /\d/.test(w) && /[A-Za-z]/.test(w) && w.includes('-'));
      const app = {
        id: item.id,
        type,
        project: project.path_with_namespace,
        webUrl: project.web_url,
        cloneUrl: project.http_url_to_repo,
        defaultBranch: project.default_branch ?? 'main',
        path: `projects/${type}/${item.id}`,
        label: item.label ?? '',
        description: item.description,
        consumes: mentioned.filter((w) => ids.some((i) => i.toLowerCase() === w.toLowerCase())).map((w) => ids.find((i) => i.toLowerCase() === w.toLowerCase())),
        consumesOutside: mentioned.filter((w) => !ids.some((i) => i.toLowerCase() === w.toLowerCase())),
      };
      const how = cloneOrUpdate(app);
      Object.assign(app, inspect(join(ROOT, app.path)), { clone: how });
      apps.push(app);
    }
    // The app's own contract, and the copies of a provider's contract (same API title) it keeps.
    for (const a of apps) {
      const providers = apps.filter((p) => a.consumes.includes(p.id));
      const copyOf = (c) => (c.title ? providers.find((p) => p.contracts.some((pc) => pc.title === c.title)) : undefined);
      a.contractCopies = a.contracts.filter((c) => copyOf(c)).map((c) => ({ path: c.path, of: copyOf(c).id }));
      const own = a.contracts.filter((c) => !copyOf(c)).map((c) => c.path);
      a.contract = a.type === 'backend' ? (own.find((p) => /(^|\/)(docs\/api|src\/main\/resources)\//.test(p)) ?? own[0] ?? null) : null;
    }
    for (const a of apps) delete a.contracts;
    const order = topo(apps);
    if (!order) need(`the applications call each other in a cycle: ${apps.map((a) => `${a.id}→${a.consumes.join('/') || '-'}`).join(', ')}`);
    const data = { issue: Number(n), story: Number(iid), generatedAt: new Date().toISOString(), apps, order };
    mkdirSync(dirname(appsFile(n)), { recursive: true });
    writeFileSync(appsFile(n), `${JSON.stringify(data, null, 2)}\n`);
    console.log(table(data));
    console.log(`\nSaved ${relative(ROOT, appsFile(n))}`);
    break;
  }
  case 'show':
  case 'order': {
    const data = readApps(n) ?? need(`no ${relative(ROOT, appsFile(n))} yet: run discover first`);
    console.log(cmd === 'order' ? data.order.join(' ') : table(data));
    break;
  }
  case 'sync': {
    const data = readApps(n) ?? need(`no ${relative(ROOT, appsFile(n))} yet: run discover first`);
    for (const id of data.order) {
      const a = data.apps.find((x) => x.id === id);
      console.log(`${a.id}: ${cloneOrUpdate(a)} · ${a.path} on ${a.defaultBranch}`);
    }
    break;
  }
  case 'branch': {
    const [branch] = args;
    if (!branch) fail('branch needs the branch name');
    const data = readApps(n) ?? need(`no ${relative(ROOT, appsFile(n))} yet: run discover first`);
    for (const id of data.order) {
      const a = data.apps.find((x) => x.id === id);
      const dir = join(ROOT, a.path);
      const exists = git(dir, 'branch', '--list', branch);
      git(dir, 'switch', '--quiet', ...(exists ? [branch] : ['-c', branch]));
      console.log(`${a.id}: on ${branch}`);
    }
    break;
  }
  case 'status': {
    const data = readApps(n) ?? need(`no ${relative(ROOT, appsFile(n))} yet: run discover first`);
    for (const id of data.order) {
      const a = data.apps.find((x) => x.id === id);
      const dir = join(ROOT, a.path);
      if (!existsSync(join(dir, '.git'))) {
        console.log(`${a.id}: not cloned`);
        continue;
      }
      const dirty = git(dir, 'status', '--porcelain') ? 'uncommitted changes' : 'clean';
      console.log(`${a.id}: ${a.path} · ${git(dir, 'branch', '--show-current')} · ${dirty} · ${git(dir, 'log', '-1', '--format=%h %s')}`);
    }
    break;
  }
  default:
    fail('commands: discover, show, order, sync, branch, status');
}
