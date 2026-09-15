#!/usr/bin/env node
/**
 * Install this skill into a FUXA-project-independent agent surface.
 *
 * Supported targets:
 *   --target vscode  GitHub Copilot in VS Code (Agent Skills discovery)
 *   --target codex   OpenAI Codex / Agent Skills discovery layout
 *
 * Supported scopes:
 *   --scope user     install for the current OS user
 *   --scope project  install into a repository (requires --project)
 *
 * The whole package is copied, because SKILL.md, references/, templates/ and
 * scripts/ are all part of the skill: an agent that only gets SKILL.md cannot
 * run the renderer or the validator.
 *
 *   node scripts/install-skill.mjs --target vscode --scope user
 *   node scripts/install-skill.mjs --target codex --scope project --project ..\my-fuxa-project --agents-md
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, boolArg } from './lib/args.mjs';

const SKILL_NAME = 'industrial-fuxa-studio';
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.DS_Store', 'backups']);
const AGENTS_MD_SECTION = `
## FUXA dashboards (industrial-fuxa-studio skill)

This repository ships the \`${SKILL_NAME}\` agent skill under \`.agents/skills/${SKILL_NAME}\`.

When a task touches FUXA views, SCADA/HMI pages, industrial dashboards, gauges or trends:

1. Read \`.agents/skills/${SKILL_NAME}/SKILL.md\` and follow its workflow.
2. Generate with \`node .agents/skills/${SKILL_NAME}/scripts/generate-dashboard.mjs\`.
3. Validate with \`node .agents/skills/${SKILL_NAME}/scripts/validate-dashboard.mjs --plan ... --view ... --charts ...\`.
4. Apply with \`--apply\` only after the user asked for a change, and back up \`/api/project\` first.
5. Never ship a static picture: every widget that carries a variable must be a native,
   data-bound FUXA element. \`dashboard-preview.svg\` is for human review only.
`;

function resolveTargetDir(target, scope, projectDir) {
  const home = os.homedir();
  if (scope === 'user') {
    if (target === 'vscode') {
      const base = process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'prompts', 'skills')
        : path.join(home, '.config', 'Code', 'User', 'prompts', 'skills');
      return path.join(base, SKILL_NAME);
    }
    return path.join(home, '.agents', 'skills', SKILL_NAME);
  }
  if (!projectDir) throw new Error('--scope project requires --project <repository root>');
  const base = path.resolve(projectDir);
  return target === 'vscode'
    ? path.join(base, '.github', 'skills', SKILL_NAME)
    : path.join(base, '.agents', 'skills', SKILL_NAME);
}

async function copyTree(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);
    if (entry.isDirectory()) await copyTree(source, destination);
    else await fs.copyFile(source, destination);
  }
}

async function upsertAgentsMd(projectDir) {
  const file = path.join(path.resolve(projectDir), 'AGENTS.md');
  let current = '';
  try {
    current = await fs.readFile(file, 'utf8');
  } catch {
    current = '';
  }
  const marker = `## FUXA dashboards (${SKILL_NAME} skill)`;
  if (current.includes(marker)) {
    console.log(`AGENTS.md already references the skill: ${file}`);
    return file;
  }
  const next = `${current.trimEnd()}${current.trim() ? '\n' : ''}${AGENTS_MD_SECTION}`;
  await fs.writeFile(file, next, 'utf8');
  console.log(`AGENTS.md updated: ${file}`);
  return file;
}

async function main() {
  const args = parseArgs();
  const target = String(args.target || 'vscode').toLowerCase();
  const scope = String(args.scope || 'user').toLowerCase();
  if (!['vscode', 'codex'].includes(target)) throw new Error(`unknown --target ${target} (use vscode|codex)`);
  if (!['user', 'project'].includes(scope)) throw new Error(`unknown --scope ${scope} (use user|project)`);

  const destination = resolveTargetDir(target, scope, args.project);
  const exists = await fs.stat(destination).then(() => true).catch(() => false);
  console.log(`${exists ? 'Replacing' : 'Installing'} ${SKILL_NAME} -> ${destination}`);
  if (exists) {
    if (!boolArg(args, 'force', false)) {
      console.log('Destination already exists. Re-run with --force to overwrite.');
      return;
    }
    await fs.rm(destination, { recursive: true, force: true });
  }
  await copyTree(PACKAGE_ROOT, destination);
  console.log('Copied SKILL.md, scripts/, references/, templates/, docs/, agents/.');

  if (boolArg(args, 'agents-md', false) || scope === 'project') {
    await upsertAgentsMd(args.project || '.');
  }

  console.log('');
  console.log('Next steps:');
  if (target === 'vscode') console.log('  Reload the VS Code window, then ask the agent for a FUXA dashboard.');
  else console.log('  Restart/refresh skills in your Codex surface, then reference the skill by name.');
  console.log(`  Verify the install:  node "${path.join(destination, 'tests', 'run-tests.mjs')}"`);
}

await main();
