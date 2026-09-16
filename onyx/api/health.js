import { gatewayFetch, readError } from './_gateway.js';
export const maxDuration = 30;
export default async function handler(req,res){
  try{
    const upstream=await gatewayFetch('/health',{method:'GET',headers:{Accept:'application/json'}});
    const text=await upstream.text();
    res.statusCode=upstream.status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(text || JSON.stringify({status:false,error:await readError(upstream)}));
  }catch(e){res.status(502).json({status:false,error:e.message||'Gateway unavailable'});}
}
