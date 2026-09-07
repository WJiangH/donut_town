#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const patterns = [
  ['credential', /xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['source avatar URL', /https:\/\/(?:avatars\.slack-edge\.com|secure\.gravatar\.com)\/[^\s"'<>]+/g],
  ['private document link', /https:\/\/docs\.google\.com\/(?:spreadsheets|document)\/d\/[A-Za-z0-9_-]{20,}/g],
  ['local account path', /\/Users\/[^/\s"']+|C:\\Users\\[^\\\s"']+/g],
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['Slack ID', /\b[UWCGD][A-Z0-9]{8,13}\b/g]
];
const examples = new Set(['C0123456789','U0123456789','U01234567890','U123456789','U1234567890','UOBSERVER','UOUTSIDER','CFAKECHANNEL','USLACKBOT','WEDNESDAY','CONFIGURATION','CONSTRAINT','DETERMINE','CATEGORIES','CONDITIONS','DISTRIBUTION','WARRANTIES']);
export function textFindings(text, privateTerms = []) {
  const hits = [];
  for (const [kind, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (kind === 'Slack ID' && examples.has(match[0])) continue;
      if (kind === 'email' && /@(?:[\w.-]+\.)?(?:example|invalid|example\.com|example\.org|example\.net|users\.noreply\.github\.com)$/.test(match[0])) continue;
      hits.push({ kind, line: text.slice(0, match.index).split('\n').length });
    }
  }
  for (const term of privateTerms.filter(Boolean)) {
    const at = text.toLowerCase().indexOf(term.toLowerCase());
    if (at >= 0) hits.push({ kind: 'private term', line: text.slice(0, at).split('\n').length });
  }
  return hits;
}

export async function checkDirectory(root, { paths, privateTerms = [], requireEmptyBindings = false } = {}) {
  if (!paths) {
    paths = [];
    async function visit(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir,entry.name), rel = relative(root,path);
        if (entry.isSymbolicLink()) { paths.push(rel); continue; }
        if (entry.isDirectory()) { if (entry.name !== '.git' && entry.name !== 'node_modules') await visit(path); }
        else paths.push(rel);
      }
    }
    await visit(root);
  }
  const hits = [];
  for (const path of paths) {
    if (/(^|\/)(\.env(?!\.example$)|\.git\/|\.donut\/|private-source\.|art-source\/)/.test(path)) hits.push({ path, kind: 'private file' });
    const data = await readFile(resolve(root,path));
    if (!data.subarray(0,8192).includes(0)) {
      for (const hit of textFindings(data.toString('utf8'),privateTerms)) hits.push({path,...hit});
    }
  }
  if (requireEmptyBindings) {
    const bindings = JSON.parse(await readFile(join(root,'characters/assignments.json'),'utf8'));
    if (Object.keys(bindings).length) hits.push({path:'characters/assignments.json',kind:'production character bindings'});
  }
  return { files: paths.length, hits };
}

async function main() {
  const { values } = parseArgs({ options: { dir:{type:'string'}, 'deny-file':{type:'string'}, history:{type:'boolean'} } });
  const root = resolve(values.dir || '.');
  const privateTerms = values['deny-file'] ? JSON.parse(await readFile(values['deny-file'],'utf8')) : [];
  const paths = values.dir ? undefined : execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
  const report = await checkDirectory(root,{paths,privateTerms,requireEmptyBindings:Boolean(values.dir)});
  if (values.history) {
    const metadata = execFileSync('git',['log','--all','--format=%an <%ae>%n%cn <%ce>%n%B'],{cwd:root}).toString();
    for (const hit of textFindings(metadata,privateTerms)) report.hits.push({path:'Git commit metadata',kind:hit.kind});
  }
  // Never print matching values; operators can inspect the indicated files privately.
  const unique = [...new Set(report.hits.map(hit => `${hit.path}${hit.line ? ':'+hit.line : ''}: ${hit.kind}`))];
  console.log(`Checked ${report.files} files. ${report.hits.length} candidate findings.`);
  for (const hit of unique) console.log('REVIEW '+hit);
  console.log('Pattern checks do not establish anonymity or verify image contents. Review artwork and full Git history before publication.');
  if (report.hits.length) process.exitCode=1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error('Privacy check failed; inspect file paths and options locally.');process.exitCode=1;});
