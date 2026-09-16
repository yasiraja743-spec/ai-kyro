import { gatewayFetch, readError } from './_gateway.js';
export const maxDuration = 30;
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({status:false,error:'Method Not Allowed'});
  try{
    const body=req.body||{};
    const path=body.action==='create' ? '/v1/payment/create' : body.action==='balance' ? '/v1/account/balance' : body.action==='key' ? '/v1/account/key' : '';
    if(!path) return res.status(400).json({status:false,error:'action harus create, balance, atau key'});
    const upstream=await gatewayFetch(path,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    const text=await upstream.text(); res.statusCode=upstream.status; res.setHeader('Content-Type','application/json; charset=utf-8'); return res.end(text||JSON.stringify({status:false,error:await readError(upstream)}));
  }catch(e){return res.status(502).json({status:false,error:e.message||'Gateway error'});}
}
