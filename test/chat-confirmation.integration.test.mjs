// Optional local Redis-compatible endpoint. Never run this against production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { ChatStore } from '../chats/store.mjs';
const url=process.env.TEST_CHAT_REDIS_URL;
test('the actual Lua script awards both partners exactly once under concurrent retries',{skip:!url},async()=>{
  assert(['127.0.0.1','localhost'].includes(new URL(url).hostname),'Use an isolated local fixture');
  const namespace='CTEST'+randomBytes(8).toString('hex').toUpperCase();
  const config={url,token:'local-test',namespace};
  const store=new ChatStore(config);
  const hash=id=>createHash('sha256').update(id).digest('hex');
  const a=hash('alice'),b=hash('bob'),other=hash('outsider');
  const record={id:hash(namespace),members:[a,b].sort(),roundId:'week:2026-08-31',matchedAt:'2026-09-01T00:00:00Z',completedAt:null,confirmations:{}};
  await store.confirm(record,a);
  await store.confirm(record,a);
  assert.deepEqual((await store.list(a)).friendships,{});
  await Promise.all(Array.from({length:20},(_,i)=>store.confirm(record,i%2?a:b)));
  for(const [self,partner] of [[a,b],[b,a]]) {
    const data=await new ChatStore(config).list(self);
    assert.equal(data.records.length,1);
    assert(data.records[0].completedAt);
    assert.equal(data.friendships[partner],1);
  }
  await assert.rejects(()=>store.confirm(record,other),/chat_not_found/);
});
