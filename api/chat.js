import { gatewayFetch, readError } from './_gateway.js';
export const maxDuration = 300;

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({status:false,error:'Method Not Allowed'});
  try {
    const body = req.method === 'POST' ? (req.body || {}) : { question: req.query?.question || '' };
    const upstream = await gatewayFetch('/v1/chat/completions', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Accept':'text/event-stream,application/json'},
      body: JSON.stringify(body)
    });
    if (!upstream.ok) return res.status(upstream.status).json({status:false,error:await readError(upstream)});
    const ct = upstream.headers.get('content-type') || '';
    res.statusCode = 200;
    res.setHeader('Content-Type', ct || 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control','no-cache, no-transform');
    res.setHeader('X-Accel-Buffering','no');
    if (!upstream.body) return res.end();
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer='';
    while(true){
      const {value,done}=await reader.read(); if(done) break;
      buffer += decoder.decode(value,{stream:true});
      const lines=buffer.split('\n'); buffer=lines.pop()||'';
      for(const line of lines){
        const t=line.trim();
        if(t.startsWith('data:')){
          const p=t.slice(5).trim();
          if(!p || p==='[DONE]') continue;
          try{
            const d=JSON.parse(p);
            const delta=d?.choices?.[0]?.delta?.content || d?.choices?.[0]?.message?.content || '';
            if(delta) res.write(delta);
          }catch{}
        }
      }
    }
    res.end();
  } catch(e) { if(!res.headersSent) res.status(502).json({status:false,error:e.message||'Gateway error'}); else res.end(); }
}
