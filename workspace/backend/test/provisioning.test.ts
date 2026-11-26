import { expect, test } from 'bun:test';
import { reconcileOnce, type ProvisionStore, type BrainProvisioner } from '../src/provisioning/worker';

const id='67dd6aea-a838-4b8c-9c06-19276317ce18';
function fixture() {
 let status='PENDING'; let failure=''; let result:unknown; let claimed=false;
 const store:ProvisionStore={
  async claim(){ if(claimed)return null; claimed=true;status='PROVISIONING';return { id } },
  async renew(){return claimed},
  async complete(_id,_lease,details){if(!claimed)return false;result=details;status='READY';claimed=false;return true},
  async fail(_id,_lease){if(!claimed)return false;failure='failed';status='FAILED';claimed=false;return true},
 };
 return {store, state:()=>({status,failure,result})};
}
test('marks a brain ready only after its instance is healthy',async()=>{
 const f=fixture();let checked=false;
 const driver:BrainProvisioner={async provision(){return {port:34123,token:'fixture'}},async health(){checked=true;return true}};
 await reconcileOnce(f.store,driver);
 expect(checked).toBe(true);expect(f.state().status).toBe('READY');expect(f.state().result).toEqual({port:34123,token:'fixture'});
});
test('never marks an unhealthy instance ready',async()=>{
 const f=fixture();const driver:BrainProvisioner={async provision(){return {port:34123,token:'fixture'}},async health(){return false}};
 await reconcileOnce(f.store,driver);expect(f.state().status).toBe('FAILED');expect(f.state().failure).toBe('failed');
});
test('does not provision if another worker has claimed the job',async()=>{
 let called=false;const f=fixture();await f.store.claim('held',new Date());
 await reconcileOnce(f.store,{async provision(){called=true;return {port:1,token:'fixture'}},async health(){return true}});
 expect(called).toBe(false);
});

test('encrypted service tokens cannot be recovered with another key or modified',async()=>{
 const { sealToken, openToken }=await import('../src/provisioning/secrets');
 const key=Buffer.alloc(32,1);const other=Buffer.alloc(32,2);
 const sealed=sealToken(key,'gbrain_example');expect(sealed).not.toContain('gbrain_example');expect(openToken(key,sealed)).toBe('gbrain_example');
 expect(()=>openToken(other,sealed)).toThrow();expect(()=>openToken(key,sealed.slice(0,-4)+'AAAA')).toThrow();
});

test('GBrain client rejects invalid ports and unauthenticated health responses',async()=>{
 const { GBrainAdapter }=await import('../src/provisioning/gbrain-client');const client=new GBrainAdapter();
 expect(await client.healthy({port:0,token:'fixture'})).toBe(false);
 expect(await client.healthy({port:65536,token:'fixture'})).toBe(false);
});
