import { PrismaClient } from '@prisma/client';
import { sealToken } from './secrets';
import type { ProvisionStore, ProvisionedBrain } from './worker';
export class PrismaProvisionStore implements ProvisionStore {
  constructor(private readonly db:PrismaClient,private readonly key:Buffer) {}
  async claim(lease:string,until:Date) {
    const eligible={ OR:[{status:'PENDING' as const},{status:'PROVISIONING' as const,leaseUntil:{lt:new Date()}}] };
    const row=await this.db.brainInstance.findFirst({where:eligible,select:{brainId:true},orderBy:{createdAt:'asc'}});
    if(!row)return null;
    const updated=await this.db.brainInstance.updateMany({where:{brainId:row.brainId,...eligible},data:{status:'PROVISIONING',leaseToken:lease,leaseUntil:until,lastError:null}});
    return updated.count===1?{id:row.brainId}:null;
  }
  async renew(id:string,lease:string,until:Date) {
    const result=await this.db.brainInstance.updateMany({where:{brainId:id,status:'PROVISIONING',leaseToken:lease,leaseUntil:{gt:new Date()}},data:{leaseUntil:until}});return result.count===1;
  }
  async complete(id:string,lease:string,result:ProvisionedBrain) {
    const updated=await this.db.brainInstance.updateMany({where:{brainId:id,status:'PROVISIONING',leaseToken:lease,leaseUntil:{gt:new Date()}},data:{status:'READY',endpointPort:result.port,encryptedMcpToken:sealToken(this.key,result.token),leaseToken:null,leaseUntil:null,lastError:null}});return updated.count===1;
  }
  async fail(id:string,lease:string) {
    const updated=await this.db.brainInstance.updateMany({where:{brainId:id,status:'PROVISIONING',leaseToken:lease},data:{status:'FAILED',leaseToken:null,leaseUntil:null,lastError:'Não foi possível provisionar a instância. Verifique o worker e tente novamente.'}});return updated.count===1;
  }
}
