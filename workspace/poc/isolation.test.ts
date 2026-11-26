/** Disposable proof only: sources are an experimental representation of logical brains, not tenant enforcement. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupDB, teardownDB, getConn } from '../../test/e2e/helpers';
import { installFixtureChunks } from '../../test/helpers/page-projection';
import { importFromContent } from '../../src/core/import-file';
import { generateToken, hashToken } from '../../src/core/utils';
import { addMember } from '../../src/core/access/members';
import type { PostgresEngine } from '../../src/core/postgres-engine';

const db = process.env.DATABASE_URL;
if (!db || process.env.CAERU_DISPOSABLE_POC !== '1') throw new Error('Run only through run-isolation.sh: destructive fixture setup requires an explicitly disposable database.');
const parsed = new URL(db);
if (!['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.pathname !== '/gbrain_test') throw new Error('POC refuses a non-loopback or non-test database.');
const sources = ['caeru-hpp','caeru-razao','cliente-comercial','cliente-operacional'] as const;
const markers = ['alfaquartz','betacobalt','gammacoral','deltasilver'];
const tokens: string[] = [];
let engine: PostgresEngine; let child: ChildProcess | undefined; let base=''; let tmp=''; let stderr='';
const vector=(n:number)=>{const v=new Float32Array(1536);v[n]=1;return v};
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const port=(s.address() as {port:number}).port;await new Promise<void>((r,j)=>s.close(e=>e?j(e):r()));return port}
async function call(token:string,name:string,args:Record<string,unknown>={}) {
 const res=await fetch(`${base}/mcp`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
 expect(res.status).toBe(200); const text=(await res.text()).trim(); const rpc=JSON.parse(text.startsWith('{')?text:text.split('\n').filter(l=>l.startsWith('data:')).at(-1)!.slice(5).trim()); expect(rpc.error).toBeUndefined();return rpc.result;
}
function payload(result:any){return JSON.parse(result.content[0].text)}
describe('Source-grant feasibility POC (NOT tenant security)',()=>{
 beforeAll(async()=>{
  engine=await setupDB();
  // POC-only catalog demonstrates data modeling; it does NOT authorize requests.
  await engine.executeRaw('CREATE TABLE IF NOT EXISTS poc_organizations (id text PRIMARY KEY)');
  await engine.executeRaw('CREATE TABLE IF NOT EXISTS poc_brains (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES poc_organizations(id), source_id text NOT NULL UNIQUE REFERENCES sources(id))');
  await engine.executeRaw('CREATE TABLE IF NOT EXISTS poc_memberships (organization_id text NOT NULL REFERENCES poc_organizations(id), member_id text NOT NULL, PRIMARY KEY (organization_id, member_id))');
  await engine.executeRaw('TRUNCATE poc_memberships, poc_brains, poc_organizations');
  await engine.executeRaw("DELETE FROM access_tokens WHERE name LIKE 'poc-%'");
  await engine.executeRaw("INSERT INTO poc_organizations VALUES ('caeru'), ('cliente-a')");
  for(let i=0;i<sources.length;i++){
   const source=sources[i]!;await engine.executeRaw('INSERT INTO sources (id,name,config) VALUES ($1,$1,\'{"federated":false}\'::jsonb)',[source]);
   await engine.executeRaw('INSERT INTO poc_brains (id,organization_id,source_id) VALUES ($1,$2,$1)',[source,i<2?'caeru':'cliente-a']);
   const slug=`notes/${source}`; const body=`Knowledge marker ${markers[i]} sharedneedle`;
   const result=await importFromContent(engine,slug,`---\ntype: note\ntitle: ${source}\n---\n\n${body}`,{sourceId:source,noEmbed:true});expect(result.status).toBe('imported');
   await installFixtureChunks(engine,slug,[{chunk_index:0,chunk_text:body,chunk_source:'compiled_truth',embedding:vector(i),token_count:4}],{sourceId:source});
   const token=generateToken('gbrain_');tokens.push(token);
   await getConn().unsafe(`INSERT INTO access_tokens (id,name,token_hash,scopes,permissions) VALUES (gen_random_uuid(),$1,$2,CASE WHEN $4 THEN ARRAY['read'] ELSE ARRAY['read','write'] END,$3::text::jsonb)`,[`poc-${source}`,hashToken(token),JSON.stringify({source_id:source,takes_holders:['world']}),i===1]);
   await addMember(engine,`member-${i}`,{bindToken:`poc-${source}`,groups:[i<2?'caeru-team':'cliente-team']});
   await engine.executeRaw('INSERT INTO poc_memberships VALUES ($1,$2)',[i<2?'caeru':'cliente-a',`member-${i}`]);
  }
  await engine.executeRaw("INSERT INTO poc_memberships VALUES ('cliente-a','member-0')");
  tmp=mkdtempSync(join(tmpdir(),'caeru-isolation-poc-'));const port=await freePort();base=`http://127.0.0.1:${port}`;
  child=spawn('bun',['--no-env-file','run','src/cli.ts','serve','--http','--bind','127.0.0.1','--port',String(port),'--public-url',base,'--suppress-bootstrap-token'],{cwd:process.cwd(),env:{...process.env,GBRAIN_HOME:tmp,GBRAIN_SKIP_STARTUP_HOOKS:'1'},stdio:['ignore','ignore','pipe']});
  child.stderr?.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000)});
  let ready=false;for(let i=0;i<240;i++){try{ready=(await fetch(`${base}/health`,{signal:AbortSignal.timeout(500)})).ok}catch{}if(ready||child.exitCode!==null)break;await Bun.sleep(250)}
  if(!ready)throw new Error(`POC MCP server failed to start: ${stderr}`);
 },600_000);
 afterAll(async()=>{if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child!.once('exit',r)),Bun.sleep(3000)])}if(engine){await engine.executeRaw('DROP TABLE IF EXISTS poc_memberships, poc_brains, poc_organizations');await engine.executeRaw("DELETE FROM access_tokens WHERE name LIKE 'poc-%'")}await teardownDB();if(tmp)rmSync(tmp,{recursive:true,force:true})},60_000);
 test('four logical brain sources and pages share one database',async()=>{expect((await engine.executeRaw('SELECT id FROM poc_organizations')).length).toBe(2);expect((await engine.executeRaw('SELECT id FROM poc_brains')).length).toBe(4);expect((await engine.executeRaw("SELECT organization_id FROM poc_memberships WHERE member_id = 'member-0'")).length).toBe(2)});
 test('each scoped credential reads its own page and not other brains, including the same organization',async()=>{
  for(let i=0;i<sources.length;i++){const own=await call(tokens[i]!, 'get_page',{slug:`notes/${sources[i]}`,source_id:sources[i]});expect(own.isError).not.toBe(true);expect(JSON.stringify(own)).toContain(markers[i]);for(let j=0;j<sources.length;j++){if(i===j)continue;const foreign=await call(tokens[i]!,'get_page',{slug:`notes/${sources[j]}`,source_id:sources[j]});expect(foreign.isError).toBe(true);expect(JSON.stringify(foreign)).not.toContain(markers[j])}}
 },120_000);
 test('text search with credentials returns only the granted source',async()=>{for(let i=0;i<sources.length;i++){const result=await call(tokens[i]!,'search',{query:'sharedneedle',match:'keyword'});expect(result.isError).not.toBe(true);const rows=payload(result);expect(rows.length).toBeGreaterThan(0);expect(rows.every((r:any)=>r.source_id===sources[i])).toBe(true)}},60_000);
 test('foreign source identifiers cannot redirect page mutation',async()=>{const result=await call(tokens[0]!,'put_page',{slug:`notes/${sources[2]}`,source_id:sources[2],content:'# injected foreign'});expect(result.isError).toBe(true);const page=await engine.getPage(`notes/${sources[2]}`,{sourceId:sources[2]});expect(page?.compiled_truth).toContain(markers[2]);},60_000);
 test('read-only member cannot write even to their own source',async()=>{const result=await call(tokens[1]!,'put_page',{slug:'notes/caeru-razao',source_id:'caeru-razao',content:'# blocked'});expect(result.isError).toBe(true)},60_000);
 test('vector query through engine scopes each result by source',async()=>{for(let i=0;i<sources.length;i++){const hits=await engine.searchVector(vector(i),{sourceId:sources[i],limit:10});expect(hits.length).toBeGreaterThan(0);expect(hits.every(h=>h.source_id===sources[i])).toBe(true)}},60_000);
});
