#!/usr/bin/env node
// StoryRail ↔ GitLab, with a personal access token (scope `api`). Plain Node, nothing to install.
// The GitLab MCP server can do the same reads when it is configured in Bob; this script is the fallback
// and the one place that writes (comments, labels, merge requests, merges).
//
// Usage (from the hub root; the token is read from the env variable named in storyrail.config.json → gitlab.tokenEnv):
//   node scripts/storyrail-gitlab.mjs whoami                                  check the URL and the token
//   node scripts/storyrail-gitlab.mjs issue <iid> [--out <dir>]              story/bug as Markdown + its attachments saved to <dir>
//   node scripts/storyrail-gitlab.mjs comment <iid> (--body <text> | --body-file <file>)
//   node scripts/storyrail-gitlab.mjs label <iid> <label>                     add a label (e.g. backlog.readyLabel)
//   node scripts/storyrail-gitlab.mjs mr-create <repo> <branch> <title> [--body-file <file>]   (target: the repo's default branch)
//   node scripts/storyrail-gitlab.mjs mr <repo> <mr-iid>                       state, merge status and pipeline of a merge request
//   node scripts/storyrail-gitlab.mjs mr-merge <repo> <mr-iid>                 merge (squash / remove branch from the config)
//   node scripts/storyrail-gitlab.mjs pipeline <repo> (--ref <branch> | --sha <commit>)   newest pipeline + its jobs
//   node scripts/storyrail-gitlab.mjs job-log <repo> <job-id> [--tail <lines>]
//
// <repo> is an application of the run in progress (e.g. INSU-ta01, from runs/issue-<N>/apps.json), `hub`, `backlog`,
// or a GitLab project path (group/project).
// Issue IIDs always belong to the backlog project. Output is plain text for people and agents; exit code 1 on API errors.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { config, fail as failWith, gitlab, enc, projectFor, defaultBranchFor } from './lib/storyrail.mjs';

const TOOL = 'storyrail-gitlab';
const fail = (msg, code) => failWith(TOOL, msg, code);
const { base: BASE, api, raw, token: TOKEN } = gitlab(TOOL);
const projectPath = (key) => projectFor(TOOL, key);

async function download(projectId, projectFullPath, secret, filename, outDir) {
  // GitLab 17.4+ has an API route for uploads; older versions only serve them on the web path.
  const urls = [
    `${BASE}/api/v4/projects/${projectId}/uploads/${secret}/${enc(filename)}`,
    `${BASE}/${projectFullPath}/uploads/${secret}/${enc(filename)}`,
  ];
  for (const url of urls) {
    const res = await raw(url);
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && !type.includes('text/html')) {
      const file = join(outDir, basename(filename));
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return file;
    }
  }
  return null;
}

function opt(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'whoami': {
    const me = await api('GET', '/user');
    console.log(`GitLab ${BASE}: signed in as ${me.username} (${me.name})`);
    break;
  }

  case 'issue': {
    const [iid] = args;
    if (!iid) fail('issue needs the issue IID, e.g. issue 51');
    const proj = await api('GET', `/projects/${enc(projectPath('backlog'))}`);
    const issue = await api('GET', `/projects/${proj.id}/issues/${iid}`);
    const notes = await api('GET', `/projects/${proj.id}/issues/${iid}/notes?sort=asc&per_page=100`);
    const human = notes.filter((n) => !n.system);
    const lines = [
      `# #${issue.iid} ${issue.title}`,
      '',
      `- URL: ${issue.web_url}`,
      `- State: ${issue.state} · Labels: ${issue.labels.join(', ') || 'none'} · Author: ${issue.author?.name ?? '?'}`,
      '',
      '## Description',
      '',
      issue.description || '(empty)',
      '',
      `## Comments (${human.length})`,
      ...human.flatMap((n) => ['', `**${n.author?.name ?? '?'}**, ${n.created_at}:`, '', n.body]),
    ];
    // Attachments: Markdown links to /uploads/<secret>/<file> in the description and the comments.
    const text = [issue.description ?? '', ...human.map((n) => n.body)].join('\n');
    const found = [...text.matchAll(/\/uploads\/([0-9a-f]{32})\/([^)\s"'\]]+)/g)].map((m) => ({ secret: m[1], file: decodeURIComponent(m[2]) }));
    const unique = [...new Map(found.map((f) => [`${f.secret}/${f.file}`, f])).values()];
    const outDir = opt(args, '--out');
    if (unique.length) {
      lines.push('', `## Attachments (${unique.length})`, '');
      if (outDir) mkdirSync(outDir, { recursive: true });
      for (const f of unique) {
        const saved = outDir ? await download(proj.id, proj.path_with_namespace, f.secret, f.file, outDir) : null;
        lines.push(`- ${f.file}: ${saved ? `saved to ${saved}` : outDir ? 'could not download (open it in GitLab and save it into the run folder)' : 'not downloaded (pass --out <dir>)'}`);
      }
    }
    console.log(lines.join('\n'));
    break;
  }

  case 'comment': {
    const [iid] = args;
    const body = opt(args, '--body') ?? (opt(args, '--body-file') ? readFileSync(opt(args, '--body-file'), 'utf8') : undefined);
    if (!iid || !body) fail('comment needs <iid> and --body <text> or --body-file <file>');
    const note = await api('POST', `/projects/${enc(projectPath('backlog'))}/issues/${iid}/notes`, { body });
    console.log(`Commented on #${iid} (note ${note.id})`);
    break;
  }

  case 'label': {
    const [iid, label] = args;
    if (!iid || !label) fail('label needs <iid> <label>');
    await api('PUT', `/projects/${enc(projectPath('backlog'))}/issues/${iid}`, { add_labels: label });
    console.log(`Added label "${label}" to #${iid}`);
    break;
  }

  case 'mr-create': {
    const [repo, branch, title] = args;
    if (!repo || !branch || !title) fail('mr-create needs <repo> <branch> <title> [--body-file <file>]');
    const description = opt(args, '--body-file') ? readFileSync(opt(args, '--body-file'), 'utf8') : '';
    const mr = await api('POST', `/projects/${enc(projectPath(repo))}/merge_requests`, {
      source_branch: branch,
      target_branch: defaultBranchFor(repo),
      title,
      description,
      squash: Boolean(config.mergeRequests?.squash),
      remove_source_branch: Boolean(config.mergeRequests?.removeSourceBranch),
    });
    console.log(`MR !${mr.iid} ${mr.web_url}`);
    break;
  }

  case 'mr': {
    const [repo, mrIid] = args;
    if (!repo || !mrIid) fail('mr needs <repo> <mr-iid>');
    const mr = await api('GET', `/projects/${enc(projectPath(repo))}/merge_requests/${mrIid}`);
    const pl = mr.head_pipeline ?? mr.pipeline;
    console.log(`!${mr.iid} ${mr.title}\nstate: ${mr.state} · merge status: ${mr.detailed_merge_status ?? mr.merge_status} · conflicts: ${mr.has_conflicts ? 'yes' : 'no'}`);
    console.log(`pipeline: ${pl ? `${pl.status} (#${pl.id}) ${pl.web_url}` : 'none yet'}`);
    if (mr.merge_commit_sha || mr.squash_commit_sha) console.log(`merged commit: ${mr.squash_commit_sha ?? mr.merge_commit_sha}`);
    console.log(mr.web_url);
    break;
  }

  case 'mr-merge': {
    const [repo, mrIid] = args;
    if (!repo || !mrIid) fail('mr-merge needs <repo> <mr-iid>');
    const mr = await api('PUT', `/projects/${enc(projectPath(repo))}/merge_requests/${mrIid}/merge`, {
      squash: Boolean(config.mergeRequests?.squash),
      should_remove_source_branch: Boolean(config.mergeRequests?.removeSourceBranch),
    });
    console.log(`Merged !${mr.iid} → ${mr.target_branch}\nmerged commit: ${mr.squash_commit_sha ?? mr.merge_commit_sha}\n${mr.web_url}`);
    break;
  }

  case 'pipeline': {
    const [repo] = args;
    const ref = opt(args, '--ref');
    const sha = opt(args, '--sha');
    if (!repo || (!ref && !sha)) fail('pipeline needs <repo> and --ref <branch> or --sha <commit>');
    const q = sha ? `sha=${sha}` : `ref=${enc(ref)}`;
    const [pl] = await api('GET', `/projects/${enc(projectPath(repo))}/pipelines?${q}&order_by=id&sort=desc&per_page=1`);
    if (!pl) {
      console.log('pipeline: none yet');
      break;
    }
    const jobs = await api('GET', `/projects/${enc(projectPath(repo))}/pipelines/${pl.id}/jobs?per_page=100&include_retried=false`);
    console.log(`pipeline #${pl.id} on ${pl.ref} (${String(pl.sha).slice(0, 8)}): ${pl.status}\n${pl.web_url}`);
    for (const j of jobs) console.log(`- ${j.stage} / ${j.name}: ${j.status}${j.status === 'failed' ? ` (job ${j.id})` : ''}`);
    break;
  }

  case 'job-log': {
    const [repo, jobId] = args;
    if (!repo || !jobId) fail('job-log needs <repo> <job-id> [--tail <lines>]');
    const res = await raw(`${BASE}/api/v4/projects/${enc(projectPath(repo))}/jobs/${jobId}/trace`);
    if (!res.ok) fail(`job log → HTTP ${res.status}`, 1);
    const tail = Number(opt(args, '--tail') ?? 80);
    console.log((await res.text()).split('\n').slice(-tail).join('\n'));
    break;
  }

  default:
    fail('commands: whoami, issue, comment, label, mr-create, mr, mr-merge, pipeline, job-log');
}
