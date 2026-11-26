export type GBrainEndpoint = { port:number; token:string };
export class GBrainAdapter {
  private url(target:GBrainEndpoint,path:string) {
    if(!Number.isInteger(target.port)||target.port<1||target.port>65535)throw new Error('Invalid GBrain endpoint');
    return `http://127.0.0.1:${target.port}${path}`;
  }
  async healthy(target:GBrainEndpoint):Promise<boolean> {
    try {
      const response=await fetch(this.url(target,'/health'),{signal:AbortSignal.timeout(5000)});
      if(!response.ok)return false;
      await this.call(target,'whoami',{});
      return true;
    } catch {return false}
  }
  async call(target:GBrainEndpoint,name:'whoami'|'search',args:Record<string,unknown>):Promise<unknown> {
    const response=await fetch(this.url(target,'/mcp'),{method:'POST',headers:{authorization:`Bearer ${target.token}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(20_000)});
    if(!response.ok)throw new Error('GBrain request failed');
    const body=await response.text();const line=body.split('\n').find(x=>x.startsWith('data:'));
    const result=JSON.parse(line?line.slice(5):body);
    if(result.error||result.result?.isError)throw new Error('GBrain operation failed');
    return result.result;
  }
}
