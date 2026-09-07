#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, lstat, copyFile, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { checkDirectory } from './check-public.mjs';

const { values } = parseArgs({ options: { out:{type:'string'}, 'deny-file':{type:'string'} } });
if (!values.out) throw new Error('Usage: npm run export:public -- --out /tmp/donut-town-public [--deny-file /private/terms.json]');
const root = resolve('.'), out = resolve(values.out);
if (out === root || out.startsWith(root+sep)) throw new Error('Export outside the source repository.');
// Refuse an existing destination; never overwrite an earlier release or source.
await mkdir(out);
const paths = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean);
for (const path of paths) {
  if (/(^|\/)(\.env(?!\.example$)|\.git\/|\.donut\/|private-source\.|art-source\/|node_modules\/)/.test(path)) throw new Error('Private file is staged/tracked; clean the source before exporting.');
  const source = resolve(root,path), target = resolve(out,path);
  if (!source.startsWith(root+sep) || !target.startsWith(out+sep)) throw new Error('Invalid export path');
  if ((await lstat(source)).isSymbolicLink()) throw new Error('Review symlinks before exporting.');
  await mkdir(dirname(target),{recursive:true});
  if (path === 'characters/assignments.json') await writeFile(target,'{}\n');
  else await copyFile(source,target);
}
const privateTerms = values['deny-file'] ? JSON.parse(await readFile(values['deny-file'],'utf8')) : [];
const report = await checkDirectory(out,{privateTerms,requireEmptyBindings:true});
console.log(`Exported ${paths.length} files without Git history or production bindings to ${out}`);
console.log('The original repository and its deployment bindings were not changed.');
if (report.hits.length) {
  console.error(`NOT READY: ${report.hits.length} privacy candidates. Run npm run privacy:check -- --dir ${out} with the same --deny-file.`);
  process.exitCode=1;
} else console.log('Text privacy checks passed. Review applicable artwork permissions and retain LICENSE and NOTICE when redistributing.');
