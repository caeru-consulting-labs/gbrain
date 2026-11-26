import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { databasePassword } from './secrets';
import { GBrainAdapter } from './gbrain-client';
import type { BrainProvisioner, ProvisionedBrain } from './worker';
const execute=promisify(execFile);
const brainIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const label='caeru.brain';
class DockerCommandError extends Error { constructor(operation:string,public readonly missing:boolean){super(`Docker ${operation} falhou`)} }
export class DockerBrainProvisioner implements BrainProvisioner {
  constructor(private readonly key:Buffer,private readonly adapter=new GBrainAdapter()) {}
  private async docker(...args:string[]):Promise<string> {
    try {const {stdout}=await execute('docker',args,{timeout:60_000,maxBuffer:1024*1024});return stdout.trim()} catch(error) {const stderr=(error as {stderr?:string}).stderr??'';throw new DockerCommandError(args[0],/No such (container|network|volume|object)|network .+ not found/i.test(stderr))}
  }
  private async exists(kind:'container'|'network'|'volume',name:string,id:string):Promise<boolean> {
    const labelPath=kind==='container'?'.Config.Labels':'.Labels';
    try {
      const actual=await this.docker(kind,'inspect','--format',`{{index ${labelPath} "${label}"}}`,name);
      if(actual!==id)throw new Error('Resource name is owned by another workload');
      return true;
    } catch(error) {
      if(error instanceof DockerCommandError&&error.missing)return false;
      throw new Error('Could not verify Docker resource ownership');
    }
  }
  private async volume(name:string,id:string) {
    if(!await this.exists('volume',name,id))await this.docker('volume','create','--label',`${label}=${id}`,name);
  }
  private async waitUntil(check:()=>Promise<boolean>,timeoutMs:number) {
    const until=Date.now()+timeoutMs;
    while(Date.now()<until){try{if(await check())return}catch{}await new Promise(r=>setTimeout(r,2000))}
    throw new Error('Provisioning timed out');
  }
  async provision(id:string):Promise<ProvisionedBrain> {
    if(!brainIdPattern.test(id))throw new Error('Invalid brain ID');
    const network=`caeru-brain-${id}`,accessNetwork=`caeru-brain-access-${id}`,db=`caeru-brain-db-${id}`,server=`caeru-brain-server-${id}`,dbVolume=`caeru-brain-pg-${id}`,homeVolume=`caeru-brain-home-${id}`;
    const password=databasePassword(this.key,id);
    console.log(`[provisioner] ${id}: preparando redes e armazenamento`);
    if(!await this.exists('network',network,id))await this.docker('network','create','--internal','--label',`${label}=${id}`,network);
    if(!await this.exists('network',accessNetwork,id))await this.docker('network','create','--label',`${label}=${id}`,accessNetwork);
    await this.volume(dbVolume,id);await this.volume(homeVolume,id);
    if(!await this.exists('container',db,id))await this.docker('run','-d','--name',db,'--label',`${label}=${id}`,'--network',network,'--network-alias','db','--restart','unless-stopped','--env','POSTGRES_USER=gbrain','--env',`POSTGRES_PASSWORD=${password}`,'--env','POSTGRES_DB=gbrain','--mount',`type=volume,src=${dbVolume},dst=/var/lib/postgresql/data`,'pgvector/pgvector:pg16');
    else await this.ensureRunning(db);
    console.log(`[provisioner] ${id}: aguardando PostgreSQL`);
    await this.waitUntil(async()=>{try{await this.docker('exec',db,'pg_isready','-U','gbrain','-d','gbrain');return true}catch{return false}},90_000);
    if(!await this.exists('container',server,id))await this.docker('create','--name',server,'--label',`${label}=${id}`,'--network',accessNetwork,'--restart','unless-stopped','--cap-drop','ALL','--security-opt','no-new-privileges','--publish','127.0.0.1::3131','--env',`DATABASE_URL=postgresql://gbrain:${password}@db:5432/gbrain?sslmode=disable`,'--mount',`type=volume,src=${homeVolume},dst=/data`,'caeru-gbrain-local:dev');
    const networks=JSON.parse(await this.docker('container','inspect','--format','{{json .NetworkSettings.Networks}}',server));
    if(!networks[network])await this.docker('network','connect',network,server);
    await this.ensureRunning(server);
    const ports=await this.docker('port',server,'3131/tcp');
    const match=ports.match(/^127\.0\.0\.1:(\d+)$/m);if(!match)throw new Error('GBrain is not bound to loopback');
    const port=Number(match[1]);
    console.log(`[provisioner] ${id}: aguardando inicialização do GBrain`);
    await this.waitUntil(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(3000)})).ok}catch{return false}},240_000);
    const output=await this.docker('exec',server,'gbrain','auth','create',`caeru-${randomUUID()}`,'--scopes','read');
    const token=output.match(/\bgbrain_[A-Za-z0-9_-]+\b/)?.[0];if(!token)throw new Error('Could not create GBrain access token');
    return {port,token};
  }
  private async ensureRunning(name:string) {
    const state=await this.docker('container','inspect','--format','{{.State.Running}}',name);
    if(state!=='true')await this.docker('start',name);
  }
  health(result:ProvisionedBrain):Promise<boolean> {return this.adapter.healthy(result)}
}
