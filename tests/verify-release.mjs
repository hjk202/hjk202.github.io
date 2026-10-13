import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { log } from 'node:console';
import process from 'node:process';
import assert from 'node:assert/strict';
import { parse } from 'yaml';

const workflow = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'));
assert.equal(workflow.jobs.deploy.needs, 'check');
for (const job of [workflow.jobs.deploy, workflow.jobs.check.steps.find((step) => step.uses?.startsWith('actions/upload-pages-artifact@'))]) {
  assert.ok(job.if.includes("github.event_name == 'workflow_dispatch'") && job.if.includes("github.ref == 'refs/heads/main'"), 'Publication must be explicit and confined to main');
}
assert.equal(workflow.jobs.deploy.permissions.pages, 'write');
assert.equal(workflow.jobs.deploy.permissions['id-token'], 'write');
assert.equal(workflow.permissions.contents, 'read');
const upload = workflow.jobs.check.steps.findIndex((step) => step.uses?.startsWith('actions/upload-pages-artifact@'));
assert.equal(workflow.jobs.check.steps[upload].with.path, 'dist');
assert.ok(workflow.jobs.check.steps.slice(0, upload).some((step) => step.run?.includes('npm run test:e2e')));
assert.ok(!workflow.jobs.deploy.steps.some((step) => step.run?.includes('build')), 'Deployment must not rebuild an untested artifact');
for (const job of Object.values(workflow.jobs)) for (const step of job.steps) if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[a-f0-9]{40}$/, 'Actions must refer to reviewed official commits');

const directory = resolve(process.argv[2] ?? 'dist');
const walk = (path) => readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]);
const files = walk(directory);
const index = JSON.parse(readFileSync(join(directory, 'search-index.json'), 'utf8'));
const routes = new Set(['/', ...index.modules.map((module) => module.route), ...index.results.map((result) => result.url)]);
const html = files.filter((file) => file.endsWith('.html'));
assert.ok(html.length >= routes.size + 1, 'Public navigation/search targets and the error page must exist; module-local pages need not appear in search');
for (const route of routes) assert.ok(files.includes(join(directory, route.slice(1), 'index.html')), `Missing public page: ${route}`);
assert.ok(files.includes(join(directory, '404.html')) && files.includes(join(directory, 'favicon.svg')));
for (const file of files) assert.ok(!/\.(?:astro|ts|md|mdx)$|(?:^|[/\\])(?:\.env|node_modules|\.git)(?:[/\\]|$)/.test(file), `Source or local data in release: ${file}`);
const manifest = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.versions.node, files: Object.fromEntries(files.map((file) => [relative(directory, file).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(file)).digest('hex')])) };
mkdirSync('.cache', { recursive: true });
writeFileSync('.cache/release-manifest.json', JSON.stringify(manifest, null, 2));
log(`Workflow and release verified: ${html.length} HTML pages, ${files.length} files, source ${manifest.source}`);
