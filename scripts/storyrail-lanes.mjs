#!/usr/bin/env node
// StoryRail lane check: after a stage, every changed file must belong to the lanes of the agents that ran in it.
// Agents that run as parallel subagents have full tools, so this check is what keeps them in their lane.
// The lanes come from the run's applications (runs/issue-<N>/apps.json, written by storyrail-apps.mjs).
//
// Usage:
//   node scripts/storyrail-lanes.mjs clean [--run N]                 the hub and every app of the run have no uncommitted changes
//   node scripts/storyrail-lanes.mjs check [--run N] <lane> [...]    uncommitted changes all fall inside these lanes
//   node scripts/storyrail-lanes.mjs lanes [--run N]                 print every lane
//
// Lanes: req-fetch, reviewer, scan, and per application dev@<app>, tests@<app>, fix@<app> (e.g. dev@INSU-ta01).
// Without --run, the newest runs/issue-*/apps.json is used.
// Exit code 0 = ok, 1 = a file outside the lanes (or not clean), 2 = usage error.

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, fail as failWith, readApps, latestApps } from './lib/storyrail.mjs';

const TOOL = 'storyrail-lanes';
const fail = (msg, code) => failWith(TOOL, msg, code);

const argv = process.argv.slice(2);
const runAt = argv.indexOf('--run');
const runN = runAt >= 0 ? argv[runAt + 1] : null;
const rest = argv.filter((_, i) => runAt < 0 || (i !== runAt && i !== runAt + 1));
const [cmd, ...lanesAsked] = rest;

const data = runN ? readApps(runN) : latestApps();
const apps = data?.apps ?? [];

const CI = ['.gitlab-ci.yml', '.github/'];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RUN = (file, label) => ({ re: new RegExp(`^runs/[^/]+/${file}$`), label: `runs/<run>/${label}` });

function lanes() {
  const L = {
    'req-fetch': { allow: ['runs/', ...apps.flatMap((a) => [a.contract, ...(a.contractCopies ?? []).map((c) => c.path)].filter(Boolean).map((p) => `${a.path}/${p}`))] },
    reviewer: { allow: [] },
    scan: { allow: ['runs/'] },
  };
  for (const a of apps) {
    const own = (p) => `${a.path}/${p}`;
    const contracts = [a.contract, ...(a.contractCopies ?? []).map((c) => c.path)].filter(Boolean).map(own);
    const tests = a.type === 'frontend' ? (a.uiTests ? [own(`${a.uiTests}/`)] : []) : (a.apiTests ? [own(`${a.apiTests}/`)] : []);
    L[`dev@${a.id}`] = { allow: [`${a.path}/`], deny: [...CI.map(own), ...contracts, ...tests], runs: [RUN(`notes/dev@${escape(a.id)}\\.md`, `notes/dev@${a.id}.md`)] };
    L[`tests@${a.id}`] = {
      allow: [...(a.type === 'frontend' ? (a.uiTests ? [own(`${a.uiTests}/`)] : [own('tests/')]) : [own('src/test/')]), 'runs/'],
      deny: contracts,
    };
    L[`fix@${a.id}`] = {
      allow: [`${a.path}/`],
      deny: [...CI.map(own), ...contracts],
      runs: [RUN(`notes/fix@${escape(a.id)}\\.md`, `notes/fix@${a.id}.md`), RUN(`fixes-round\\d+-${escape(a.id)}\\.md`, `fixes-round<k>-${a.id}.md`)],
    };
  }
  return L;
}

/** Uncommitted changes (modified, added, deleted, untracked) of one repo, as paths relative to the hub root. */
function changes(repoDir, prefix) {
  if (!existsSync(join(repoDir, '.git'))) return [];
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repoDir, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''))
    .map((path) => (prefix ? `${prefix}/${path}` : path));
}

function allChanges() {
  // The hub ignores projects/, so its own status never lists project files twice.
  const files = changes(ROOT, '');
  for (const a of apps) files.push(...changes(join(ROOT, a.path), a.path));
  return files;
}

function inLane(file, lane) {
  const allowed = lane.allow.some((prefix) => file === prefix || file.startsWith(prefix));
  const denied = (lane.deny ?? []).some((prefix) => file === prefix || file.startsWith(prefix));
  const inRun = (lane.runs ?? []).some((r) => r.re.test(file));
  return (allowed && !denied) || inRun;
}

switch (cmd) {
  case 'clean': {
    const files = allChanges();
    if (files.length) {
      console.error(`Not clean: ${files.length} uncommitted change(s):\n  ${files.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`clean: no uncommitted changes in the hub${apps.length ? ` or ${apps.map((a) => a.id).join(', ')}` : ''}`);
    break;
  }
  case 'check': {
    if (!lanesAsked.length) fail('check needs the lanes of the agents that ran, e.g. check dev@INSU-ta01 dev@INSU-fa01');
    const L = lanes();
    const unknown = lanesAsked.filter((a) => !L[a]);
    if (unknown.length) fail(`unknown lane(s) ${unknown.join(', ')}. Known: ${Object.keys(L).join(' ')}${apps.length ? '' : ' (no apps.json found: pass --run N)'}`);
    const outside = allChanges().filter((file) => !lanesAsked.some((a) => inLane(file, L[a])));
    if (outside.length) {
      console.error(`Outside the lanes of ${lanesAsked.join(' + ')}:\n  ${outside.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`ok: every change is inside the lanes of ${lanesAsked.join(' + ')}`);
    break;
  }
  case 'lanes':
    for (const [name, lane] of Object.entries(lanes())) {
      const deny = lane.deny?.length ? ` (not ${lane.deny.join(', ')})` : '';
      const runs = lane.runs?.length ? `, ${lane.runs.map((r) => r.label).join(', ')}` : '';
      console.log(`${name}: ${lane.allow.join(', ') || 'nothing (read-only)'}${deny}${runs}`);
    }
    break;
  default:
    fail('commands: clean, check <lane> [...], lanes   (all take --run N)');
}
