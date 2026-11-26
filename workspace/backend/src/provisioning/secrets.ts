import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
export function provisionKey():Buffer {
  const value=process.env.BRAIN_PROVISIONER_KEY;
  if(!value||! /^[0-9a-f]{64}$/i.test(value))throw new Error('BRAIN_PROVISIONER_KEY must be 64 hexadecimal characters');
  return Buffer.from(value,'hex');
}
export function databasePassword(key:Buffer,brainId:string):string {
  return createHmac('sha256',key).update('caeru-brain-database-v1:').update(brainId).digest('hex');
}
export function sealToken(key:Buffer,token:string):string {
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(x=>x.toString('base64url')).join('.');
}
export function openToken(key:Buffer,value:string):string {
  const parts=value.split('.');if(parts.length!==3)throw new Error('Invalid credential');
  const [iv,tag,encrypted]=parts.map(x=>Buffer.from(x,'base64url'));
  if(iv.length!==12||tag.length!==16)throw new Error('Invalid credential');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
}
