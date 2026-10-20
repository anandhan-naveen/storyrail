#!/usr/bin/env node
// StoryRail workspace: the project repos StoryRail works on, cloned side by side under projects/.
// Reads storyrail.config.json. Never changes a project with uncommitted work.
//
// Usage:
//   node scripts/storyrail-workspace.mjs sync      clone missing projects, otherwise switch to main and fast-forward
//   node scripts/storyrail-workspace.mjs status    branch, clean/dirty and last commit of every project
//   node scripts/storyrail-workspace.mjs config    print the config (backlog repo, project repos, paths, QA URLs)
//   node scripts/storyrail-workspace.mjs todo      list the TODO(office) placeholders still to fill in
//
// `sync` and `status` also cover the enabled reference apps (references.* in the config), cloned read-only into references/.

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'storyrail.config.json'), 'utf8'));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fail(msg) {
  console.error(`storyrail-workspace: ${msg}`);
  process.exit(2);
}

const projects = Object.entries(config.projects);
const references = Object.entries(config.references ?? {})
  .filter(([, r]) => r && r.enabled)
  .map(([name, r]) => {
    if (String(r.cloneUrl).startsWith('TODO')) fail(`references.${name} is enabled but cloneUrl is still a TODO(office) placeholder`);
    return [`reference ${name}`, { ...r, repo: r.repo, readOnly: true }];
  });
const [cmd] = process.argv.slice(2);

switch (cmd) {
  case 'sync': {
    let problems = 0;
    for (const [lane, p] of [...projects, ...references]) {
      const dir = join(ROOT, p.path);
      const branch = p.branch ?? 'main';
      if (!existsSync(join(dir, '.git'))) {
        mkdirSync(dirname(dir), { recursive: true });
        console.log(`${lane}: cloning ${p.cloneUrl} into ${p.path}`);
        execFileSync('git', ['clone', '--quiet', '--branch', branch, p.cloneUrl, dir], { stdio: 'inherit' });
        continue;
      }
      if (git(dir, 'status', '--porcelain')) {
        console.error(`${lane}: ${p.path} has uncommitted changes; left as is. Commit, stash or discard them first.`);
        problems++;
        continue;
      }
      git(dir, 'switch', '--quiet', branch);
      git(dir, 'pull', '--quiet', '--ff-only');
      console.log(`${lane}: ${p.path} on main at ${git(dir, 'log', '-1', '--format=%h %s')}`);
    }
    if (problems) process.exit(1);
    break;
  }
  case 'status':
    for (const [lane, p] of [...projects, ...references]) {
      const dir = join(ROOT, p.path);
      if (!existsSync(join(dir, '.git'))) {
        console.log(`${lane}: not cloned (run: node scripts/storyrail-workspace.mjs sync)`);
        continue;
      }
      const dirty = git(dir, 'status', '--porcelain') ? 'uncommitted changes' : 'clean';
      console.log(`${lane}: ${p.repo} · ${p.path} · ${git(dir, 'branch', '--show-current')} · ${dirty} · ${git(dir, 'log', '-1', '--format=%h %s')}`);
    }
    break;
  case 'config':
    console.log(JSON.stringify(config, null, 2));
    break;
  case 'todo': {
    // Placeholders left for the office setup, in the config and the Bob rules.
    let out = '';
    try {
      out = execFileSync('git', ['grep', '-n', '-I', '-F', 'TODO(office)', '--', 'storyrail.config.json', '.bob'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      out = ''; // git grep exits 1 when nothing matches
    }
    console.log(out || 'Nothing left: every TODO(office) placeholder is filled in.');
    break;
  }
  default:
    fail('commands: sync, status, config, todo');
}
