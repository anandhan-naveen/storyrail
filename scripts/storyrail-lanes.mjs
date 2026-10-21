#!/usr/bin/env node
// StoryRail lane check: after a stage, every changed file must belong to the lanes of the agents that ran in it.
// Agents that run as parallel subagents have full tools, so this check is what keeps them in their lane.
//
// Usage:
//   node scripts/storyrail-lanes.mjs clean                 every repo (hub + projects) has no uncommitted changes
//   node scripts/storyrail-lanes.mjs check <agent> [...]   uncommitted changes all fall inside these agents' lanes
//   node scripts/storyrail-lanes.mjs lanes                 print the lane of every agent
//
// Exit code 0 = ok, 1 = a file outside the lanes (or not clean), 2 = usage error.
// Run `clean` before a stage and `check` after it, before committing.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'storyrail.config.json'), 'utf8'));
const FE = config.projects.frontend.path;
const BE = config.projects.backend.path;
const AT = config.projects.apiTests.path;

// Paths are relative to the hub root. `allow` = prefixes the agent may change; `deny` = exceptions inside them;
// `notes` = the station whose work notes (runs/<run>/notes/<station>.md) the agent may also write.
const LANES = {
  'req-fetch': { allow: ['runs/', `${BE}/docs/api/openapi.yaml`, `${FE}/contract/openapi.yaml`, `${AT}/contract/openapi.yaml`] },
  'fe-dev': { allow: [`${FE}/`], deny: [`${FE}/tests/`, `${FE}/contract/`, `${FE}/.github/`], notes: 'fe-dev' },
  'be-dev': { allow: [`${BE}/`], deny: [`${BE}/docs/api/`, `${BE}/.github/`], notes: 'be-dev' },
  'ui-tests': { allow: [`${FE}/tests/ui/`, 'runs/'] },
  'api-tests': { allow: [`${AT}/src/test/`, `${AT}/README.md`, 'runs/'] },
  reviewer: { allow: [] },
  scan: { allow: ['runs/'] },
  fixer: { allow: [`${FE}/`, `${BE}/`, `${AT}/`, 'runs/'], deny: [`${FE}/.github/`, `${BE}/.github/`, `${AT}/.github/`] },
  'manual-qa': { allow: ['runs/', 'tests/manual/'] },
};

function fail(msg, code = 2) {
  console.error(`storyrail-lanes: ${msg}`);
  process.exit(code);
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
  for (const p of [FE, BE, AT]) files.push(...changes(join(ROOT, p), p));
  return files;
}

function inLane(file, lane) {
  const allowed = lane.allow.some((prefix) => file === prefix || file.startsWith(prefix));
  const denied = (lane.deny ?? []).some((prefix) => file.startsWith(prefix));
  const notes = lane.notes && new RegExp(`^runs/[^/]+/notes/${lane.notes}\\.md$`).test(file);
  return (allowed && !denied) || Boolean(notes);
}

const [cmd, ...agents] = process.argv.slice(2);

switch (cmd) {
  case 'clean': {
    const files = allChanges();
    if (files.length) {
      console.error(`Not clean: ${files.length} uncommitted change(s):\n  ${files.join('\n  ')}`);
      process.exit(1);
    }
    console.log('clean: no uncommitted changes in the hub or the projects');
    break;
  }
  case 'check': {
    if (!agents.length) fail('check needs the agents that ran in this stage, e.g. check fe-dev be-dev');
    const unknown = agents.filter((a) => !LANES[a]);
    if (unknown.length) fail(`unknown agent(s) ${unknown.join(', ')}. Known: ${Object.keys(LANES).join(' ')}`);
    const outside = allChanges().filter((file) => !agents.some((a) => inLane(file, LANES[a])));
    if (outside.length) {
      console.error(`Outside the lanes of ${agents.join(' + ')}:\n  ${outside.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`ok: every change is inside the lanes of ${agents.join(' + ')}`);
    break;
  }
  case 'lanes':
    for (const [agent, lane] of Object.entries(LANES)) {
      const deny = lane.deny?.length ? ` (not ${lane.deny.join(', ')})` : '';
      const notes = lane.notes ? `, runs/<run>/notes/${lane.notes}.md` : '';
      console.log(`${agent}: ${lane.allow.join(', ') || 'nothing (read-only)'}${deny}${notes}`);
    }
    break;
  default:
    fail('commands: clean, check <agent> [...], lanes');
}
