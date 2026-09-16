import { gatewayFetch, readError } from './_gateway.js';
export const maxDuration = 30;
export default async function handler(req,res){
  const action = String(req.query?.action || (req.body && req.body.action) || '');
  const map = { login:'/v1/admin/login', logout:'/v1/admin/logout', stats:'/v1/admin/stats', users:'/v1/admin/users', payments:'/v1/admin/payments', health:'/v1/admin/health' };
  const path = map[action];
  if(!path) return res.status(400).json({status:false,error:'action harus login, logout, stats, users, payments, atau health'});
  try{
    const headers = {'Content-Type':'application/json','Accept':'application/json'};
    const token = req.headers.authorization || req.headers['x-onyx-admin-token'];
    if(token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const upstream = await gatewayFetch(path,{method:req.method==='GET'?'GET':'POST',headers,body:req.method==='GET'?undefined:JSON.stringify(req.body||{})});
    const text=await upstream.text(); res.statusCode=upstream.status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(text || JSON.stringify({status:false,error:await readError(upstream)}));
  }catch(e){res.status(502).json({status:false,error:e.message||'Gateway error'});}
}
