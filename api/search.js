import { gatewayFetch, readError } from './_gateway.js';
export const maxDuration = 60;
export default async function handler(req,res){
  if(req.method!=='GET' && req.method!=='POST') return res.status(405).json({status:false,error:'Method Not Allowed'});
  try{
    const body=req.method==='POST'?(req.body||{}):(req.query||{});
    const upstream=await gatewayFetch('/v1/search',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    const text=await upstream.text();
    res.statusCode=upstream.status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(text || JSON.stringify({status:false,error:await readError(upstream)}));
  }catch(e){res.status(502).json({status:false,error:e.message||'Gateway error'});}
}
