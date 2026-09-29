import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from '../catalog.js';
import { PROJECTS_DIR } from '../installer.js';
import { listProjects } from '../projects.js';
import { loadSpecContext, readSpecFacts, readStatus, SPEC_DIR_PATTERN } from './context.js';
import { decideScanAction } from './scan.js';

export async function scanHome(homeDir, now) {
  const projects = await listProjects(homeDir);
  const perProject = await Promise.all(projects.map((project) => scanProject(homeDir, project, now)));
  return perProject.flat();
}

async function scanProject(homeDir, project, now) {
  const specsDir = path.join(project.dir, 'specs');
  const entries = await readdir(specsDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const specNames = entries.filter((entry) => entry.isDirectory() && SPEC_DIR_PATTERN.test(entry.name)).map((entry) => entry.name).sort();
  return Promise.all(specNames.map((specName) => scanSpec(homeDir, project, specName, now)));
}

async function scanSpec(homeDir, project, specName, now) {
  const specPath = toPosix(path.join(PROJECTS_DIR, project.name, 'specs', specName));
  const context = await loadSpecContext(homeDir, specPath);
  const facts = await readSpecFacts(context.specPath);
  const status = await readStatus(context);
  const decision = decideScanAction({ specStatus: facts.specStatus, status, specHash: facts.specHash, now });
  return { project: project.name, spec: specName, path: specPath, state: status?.state ?? null, ...decision };
}
