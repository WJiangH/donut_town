import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { textFindings, checkDirectory } from '../scripts/check-public.mjs';

test('public check flags identifiers and private text without echoing the value', () => {
  const secret = 'xoxb-' + '1234567890'.repeat(3);
  const member = 'U' + '9A8B7C6D5E';
  const mail = ['sample-person','personal-mail.test'].join('@');
  const text = [secret,member,mail,'A Sample Private Name'].join('\n');
  const hits = textFindings(text,['Sample Private Name']);
  for (const kind of ['credential','Slack ID','email','private term']) assert(hits.some(hit=>hit.kind===kind));
  for (const value of [secret,member,mail,'Sample Private Name']) assert(!JSON.stringify(hits).includes(value));
  assert.deepEqual(textFindings('C0123456789 user@example.com WEDNESDAY CONDITIONS DISTRIBUTION WARRANTIES'),[]);
});

test('public snapshots require empty production bindings and reject private files', async () => {
  const root = await mkdtemp(join(tmpdir(),'donut-release-test-'));
  try {
    await mkdir(join(root,'characters'));
    await writeFile(join(root,'characters/assignments.json'),JSON.stringify({['a'.repeat(64)]:'r-sample'}));
    await writeFile(join(root,'.env.local'),'TOKEN=fixture');
    const dirty = await checkDirectory(root,{requireEmptyBindings:true});
    assert(dirty.hits.some(hit=>hit.kind==='private file'));
    assert(dirty.hits.some(hit=>hit.kind==='production character bindings'));
    await rm(join(root,'.env.local'));
    await writeFile(join(root,'characters/assignments.json'),'{}');
    assert.deepEqual((await checkDirectory(root,{requireEmptyBindings:true})).hits,[]);
  } finally { await rm(root,{recursive:true,force:true}); }
});
