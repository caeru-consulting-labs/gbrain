import { randomUUID } from 'node:crypto';

export type ProvisionedBrain = { port:number; token:string };
export interface BrainProvisioner {
  /** Reconcile resources using the same brain ID across retries. */
  provision(brainId:string):Promise<ProvisionedBrain>;
  /** Validate the native HTTP health endpoint and an authenticated MCP call. */
  health(brain:ProvisionedBrain):Promise<boolean>;
}
export interface ProvisionStore {
  claim(lease:string, until:Date):Promise<{id:string}|null>;
  renew(id:string, lease:string, until:Date):Promise<boolean>;
  complete(id:string, lease:string, result:ProvisionedBrain):Promise<boolean>;
  fail(id:string, lease:string):Promise<boolean>;
}
const leaseDuration=120_000;
export async function reconcileOnce(store:ProvisionStore, provisioner:BrainProvisioner):Promise<boolean> {
  const lease=randomUUID();
  const item=await store.claim(lease,new Date(Date.now()+leaseDuration));
  if(!item)return false;
  let lost=false;let renewing=false;
  const heartbeat=setInterval(()=>{if(renewing)return;renewing=true;void store.renew(item.id,lease,new Date(Date.now()+leaseDuration)).then(ok=>{if(!ok)lost=true}).catch(()=>{lost=true}).finally(()=>{renewing=false})},15_000);
  try {
    const result=await provisioner.provision(item.id);
    if(lost||!await provisioner.health(result))throw new Error('Instance health check failed');
    if(!await store.complete(item.id,lease,result))throw new Error('Provision lease was lost');
  } catch(error) {
    const message=error instanceof Error&&/^(Docker (container|network|volume|run|create|exec|port|start) falhou|Provisioning timed out|Instance health check failed|Provision lease was lost|Could not verify Docker resource ownership|GBrain is not bound to loopback|Could not create GBrain access token|Invalid brain ID)$/.test(error.message)?error.message:'erro interno de provisionamento';
    console.error(`[provisioner] ${item.id}: ${message}`);
    await store.fail(item.id,lease);
  } finally {clearInterval(heartbeat)}
  return true;
}
