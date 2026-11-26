import { PrismaClient } from '@prisma/client';
import { DockerBrainProvisioner } from './docker-provisioner';
import { PrismaProvisionStore } from './prisma-store';
import { openToken, provisionKey } from './secrets';
import { GBrainAdapter } from './gbrain-client';
import { reconcileOnce } from './worker';

async function main() {
  const key=provisionKey();const db=new PrismaClient();const store=new PrismaProvisionStore(db,key);const driver=new DockerBrainProvisioner(key);
  const failures=new Map<string,number>();let checking=false;const adapter=new GBrainAdapter();
  const timer=setInterval(()=>{if(checking)return;checking=true;void (async()=>{
    const rows=await db.brainInstance.findMany({where:{status:'READY'},select:{brainId:true,endpointPort:true,encryptedMcpToken:true}});
    for(const row of rows){let healthy=false;try{if(row.endpointPort&&row.encryptedMcpToken)healthy=await adapter.healthy({port:row.endpointPort,token:openToken(key,row.encryptedMcpToken)})}catch{}
      if(healthy){failures.delete(row.brainId);continue}const count=(failures.get(row.brainId)??0)+1;failures.set(row.brainId,count);
      if(count>=3){await db.brainInstance.updateMany({where:{brainId:row.brainId,status:'READY',endpointPort:row.endpointPort,encryptedMcpToken:row.encryptedMcpToken},data:{status:'STOPPED',lastError:'A instância não respondeu à verificação de saúde.'}});failures.delete(row.brainId)}
    }
  })().catch(()=>console.error('Provisioner health check failed.')).finally(()=>{checking=false})},15_000);
  let stopping=false;process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true});
  console.log('Caeru provisioner started.');
  try {
    while(!stopping) {
      try {if(!await reconcileOnce(store,driver))await new Promise(r=>setTimeout(r,3000))}
      catch {console.error('Provisioner could not claim or update a job; retrying.');await new Promise(r=>setTimeout(r,5000))}
    }
  } finally {clearInterval(timer);await db.$disconnect()}
}
main().catch(()=>{console.error('Provisioner could not start. Check configuration.');process.exitCode=1});
