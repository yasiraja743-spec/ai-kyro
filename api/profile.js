import { gatewayFetch, readError } from './_gateway.js';
import { requireFirebaseUser } from './_firebase-admin.js';
export const maxDuration = 30;

export default async function handler(req,res){
  if(!['GET','POST','DELETE'].includes(req.method)) return res.status(405).json({status:false,error:'Method Not Allowed'});
  try{
    const user=await requireFirebaseUser(req);
    const customer_id=user.uid;
    let path='/v1/account/profile';
    let method='POST';
    let body={customer_id};
    if(req.method==='POST' && String(req.query?.action||'')==='generate') path='/v1/account/key';
    if(req.method==='POST' && String(req.query?.action||'')==='revoke') path='/v1/account/key/revoke';
    if(req.method==='GET'){ path='/v1/account/profile'; method='POST'; }
    const upstream=await gatewayFetch(path,{method,headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    const text=await upstream.text();
    res.statusCode=upstream.status; res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.end(text||JSON.stringify({status:false,error:await readError(upstream)}));
  }catch(e){ return res.status(e.statusCode||502).json({status:false,error:e.message||'Profile error'}); }
}
