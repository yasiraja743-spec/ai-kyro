import { gatewayFetch, readError } from './_gateway.js';
export const maxDuration = 300;
export default async function handler(req,res){
  if(req.method!=='POST' && req.method!=='GET') return res.status(405).json({status:false,error:'Method Not Allowed'});
  try{
    const body=req.method==='POST'?(req.body||{}):(req.query||{});
    const upstream=await gatewayFetch('/v1/images/edits',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json,image/*'},body:JSON.stringify(body)});
    const ct=upstream.headers.get('content-type')||'';
    if(!upstream.ok) return res.status(upstream.status).json({status:false,error:await readError(upstream)});
    const buf=Buffer.from(await upstream.arrayBuffer());
    res.statusCode=200; res.setHeader('Content-Type',ct||'application/octet-stream'); res.setHeader('Cache-Control','no-store'); res.end(buf);
  }catch(e){return res.status(502).json({status:false,error:e.message||'Gateway error'});}
}
