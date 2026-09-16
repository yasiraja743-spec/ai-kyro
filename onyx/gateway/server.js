import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import {
  ensureAccount, issueApiKey, findApiKey, getBalance, spendCredits, refundCredits,
  createPaymentRow, getPayment, settlePayment, updatePaymentStatus
} from './db.js';

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.GATEWAY_SECRET || '';
const CHAT_URL = process.env.CHAT_URL || 'http://127.0.0.1:8000/v1/chat/completions';
const PIXAZO_API_KEY = process.env.PIXAZO_API_KEY || '';
const PIXAZO_BASE = process.env.PIXAZO_BASE_URL || 'https://gateway.pixazo.ai';
const PIXAZO_IMAGE_MODEL = process.env.PIXAZO_IMAGE_MODEL || 'flux/text-to-image';
const PIXAZO_EDIT_MODEL = process.env.PIXAZO_EDIT_MODEL || 'p-image/v1/p-image-edit/generate';
const TAVILY = process.env.TAVILY_API_KEY || '';
const PAKASIR_PROJECT = process.env.PAKASIR_PROJECT || '';
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY || '';
const PAKASIR_BASE = process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com';
const COST_CHAT = Number(process.env.COST_CHAT || 1);
const COST_IMAGE = Number(process.env.COST_IMAGE || 5);
const COST_EDIT = Number(process.env.COST_EDIT || 5);
const COST_SEARCH = Number(process.env.COST_SEARCH || 1);

function send(res, status, data, ct = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
async function body(req) { const chunks=[]; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); }
async function jsonBody(req) { const b=await body(req); try{return JSON.parse(b.toString()||'{}')}catch{return {}} }
function gatewayAuthorized(req) { return Boolean(SECRET) && req.headers['x-onyx-gateway-key'] === SECRET; }
function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : (req.headers['x-onyx-api-key'] || '').trim();
}
function access(req, cost = 0) {
  if (gatewayAuthorized(req)) return { privileged: true, customerId: null, charged: 0 };
  const account = findApiKey(bearer(req));
  if (!account) return { error: 'API key tidak valid atau sudah dicabut', status: 401 };
  if (cost > 0 && !spendCredits(account.customer_id, cost)) return { error: `Saldo credit tidak cukup. Butuh ${cost} credit.`, status: 402 };
  return { privileged: false, customerId: account.customer_id, charged: cost };
}
async function proxyJson(res, url, payload) {
  const r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json,text/event-stream,image/*,*/*'},body:JSON.stringify(payload)});
  const ct=r.headers.get('content-type')||''; const b=Buffer.from(await r.arrayBuffer());
  res.writeHead(r.status,{'Content-Type':ct||'application/octet-stream','Cache-Control':'no-store'}); res.end(b);
}

async function pixazoRequest(path, payload) {
  if (!PIXAZO_API_KEY) throw new Error('PIXAZO_API_KEY belum dikonfigurasi di VPS');
  const r=await fetch(`${PIXAZO_BASE}/${path.replace(/^\//,'')}`,{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','Ocp-Apim-Subscription-Key':PIXAZO_API_KEY,'Accept':'application/json'},body:JSON.stringify(payload)});
  const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}};
  if(!r.ok) throw new Error(data?.message||data?.error||`Pixazo HTTP ${r.status}`);
  return data;
}
async function pixazoResult(data){
  let url=data?.output?.media_url?.[0]||data?.media_url?.[0]||data?.media_url||data?.url;
  if(url) return url;
  if(!data?.request_id) throw new Error('Pixazo tidak mengembalikan hasil');
  for(let i=0;i<60;i++){
    await new Promise(r=>setTimeout(r,5000));
    const r=await fetch(`${PIXAZO_BASE}/v2/requests/status/${encodeURIComponent(data.request_id)}`,{headers:{'Ocp-Apim-Subscription-Key':PIXAZO_API_KEY,'Accept':'application/json'}});
    const text=await r.text(); let st; try{st=JSON.parse(text)}catch{st={raw:text}};
    if(!r.ok) throw new Error(st?.message||st?.error||`Pixazo status HTTP ${r.status}`);
    if(st.status==='COMPLETED') return st?.output?.media_url?.[0]||st?.media_url?.[0]||st?.url||(()=>{throw new Error('URL hasil Pixazo tidak ditemukan')})();
    if(['FAILED','ERROR'].includes(st.status)) throw new Error(st.error||'Pixazo gagal memproses gambar');
  }
  throw new Error('Pixazo timeout');
}
async function pixazoImage(res,payload,edit=false){
  const prompt=String(payload.prompt||payload.input||'').trim();
  if(!prompt) throw new Error('prompt wajib diisi');
  const body=edit?{prompt,images:[String(payload.url||payload.image||'')],turbo:true}:{prompt};
  if(edit&&!body.images[0]) throw new Error('url/image wajib diisi untuk edit foto');
  const data=await pixazoRequest(edit?PIXAZO_EDIT_MODEL:PIXAZO_IMAGE_MODEL,body);
  const url=await pixazoResult(data);
  const img=await fetch(url); if(!img.ok) throw new Error(`Gagal mengambil hasil gambar Pixazo (${img.status})`);
  res.writeHead(200,{'Content-Type':img.headers.get('content-type')||'image/jpeg','Cache-Control':'no-store'}); res.end(Buffer.from(await img.arrayBuffer()));
}

async function pakasirRequest(path, options = {}) {
  const r = await fetch(`${PAKASIR_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(options.headers || {}) }
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data?.message || data?.error || data?.errors?.join?.(', ') || `Pakasir HTTP ${r.status}`);
  return data;
}

async function createQrisPayment({customerId, amount, credits}) {
  if (!PAKASIR_PROJECT || !PAKASIR_API_KEY) throw new Error('PAKASIR_PROJECT/PAKASIR_API_KEY belum dikonfigurasi di VPS');
  const orderId = `onyx-${crypto.randomBytes(8).toString('hex')}`;
  createPaymentRow(orderId, customerId, amount, credits);
  try {
    const data = await pakasirRequest('/api/transactioncreate/qris', {
      method: 'POST',
      body: JSON.stringify({ project: PAKASIR_PROJECT, order_id: orderId, amount, api_key: PAKASIR_API_KEY })
    });
    return { order_id: orderId, ...data };
  } catch (e) {
    updatePaymentStatus(orderId, 'failed');
    throw e;
  }
}

async function verifyPakasirTransaction(order) {
  if (!PAKASIR_PROJECT || !PAKASIR_API_KEY) return null;
  const q = new URLSearchParams({
    project: PAKASIR_PROJECT,
    amount: String(order.amount),
    order_id: order.order_id,
    api_key: PAKASIR_API_KEY
  });
  return pakasirRequest(`/api/transactiondetail?${q.toString()}`, { method: 'GET', headers: { 'Content-Type': undefined } });
}

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host}`);

    if(u.pathname==='/health') return send(res,200,{status:true,service:'ONYX AI Gateway',architecture:'single-vps',routes:{chat:true,generate:Boolean(PIXAZO_API_KEY),edit:Boolean(PIXAZO_API_KEY),search:Boolean(TAVILY),api_keys:true,payment:Boolean(PAKASIR_PROJECT&&PAKASIR_API_KEY)}});

    // Pakasir webhook: verify order/amount against our DB, then re-check transaction detail.
    if(u.pathname==='/v1/payment/webhook' && req.method==='POST'){
      const data=await jsonBody(req);
      const orderId=String(data.order_id||'').trim();
      const order=getPayment(orderId);
      if(!order) return send(res,404,{status:false,error:'Order not found'});
      const amount=Number(data.amount);
      if(!Number.isFinite(amount) || amount!==Number(order.amount)) return send(res,400,{status:false,error:'Amount tidak sesuai'});
      if(String(data.project||'')!==PAKASIR_PROJECT) return send(res,400,{status:false,error:'Project tidak sesuai'});
      if(String(data.status||'')==='completed') {
        const verified=await verifyPakasirTransaction(order);
        const tx=verified?.transaction;
        if(!tx || String(tx.status)!=='completed' || Number(tx.amount)!==Number(order.amount)) return send(res,400,{status:false,error:'Transaksi gagal diverifikasi'});
        settlePayment(order.order_id,tx.payment_method||data.payment_method||'qris');
      } else {
        updatePaymentStatus(order.order_id,String(data.status||'unknown'),data.payment_method||null);
      }
      return send(res,200,{status:true});
    }

    // Internal Vercel -> VPS routes use the gateway secret.
    if(u.pathname==='/v1/account/key' && req.method==='POST'){
      if(!gatewayAuthorized(req)) return send(res,401,{status:false,error:'Unauthorized'});
      const data=await jsonBody(req); const customerId=String(data.customer_id||'').trim();
      if(!customerId || customerId.length>120) return send(res,400,{status:false,error:'customer_id wajib diisi'});
      const key=issueApiKey(customerId); return send(res,201,{status:true,customer_id:customerId,api_key:key,warning:'Simpan API key ini. Key plaintext hanya ditampilkan sekali.'});
    }
    if(u.pathname==='/v1/account/balance' && req.method==='POST'){
      if(!gatewayAuthorized(req)) return send(res,401,{status:false,error:'Unauthorized'});
      const data=await jsonBody(req); const customerId=String(data.customer_id||'').trim();
      if(!customerId) return send(res,400,{status:false,error:'customer_id wajib diisi'});
      return send(res,200,{status:true,customer_id:customerId,credits:getBalance(customerId)});
    }
    if(u.pathname==='/v1/payment/create' && req.method==='POST'){
      if(!gatewayAuthorized(req)) return send(res,401,{status:false,error:'Unauthorized'});
      const data=await jsonBody(req); const customerId=String(data.customer_id||'').trim();
      const amount=Math.round(Number(data.amount)); const credits=Math.round(Number(data.credits));
      if(!customerId || !Number.isFinite(amount) || amount<1000 || !Number.isFinite(credits) || credits<1) return send(res,400,{status:false,error:'customer_id, amount (>=1000), dan credits wajib valid'});
      const payment=await createQrisPayment({customerId,amount,credits});
      return send(res,201,{status:true,payment});
    }

    if(req.method!=='POST') return send(res,405,{status:false,error:'Method Not Allowed'});

    let cost=0;
    if(u.pathname==='/v1/chat/completions') cost=COST_CHAT;
    else if(u.pathname==='/v1/images/generations') cost=COST_IMAGE;
    else if(u.pathname==='/v1/images/edits') cost=COST_EDIT;
    else if(u.pathname==='/v1/search') cost=COST_SEARCH;
    const auth=access(req,cost);
    if(auth.error) return send(res,auth.status,{status:false,error:auth.error});

    const data=await jsonBody(req);
    if(u.pathname==='/v1/chat/completions'){
      const r=await fetch(CHAT_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream,application/json'},body:JSON.stringify(data)});
      if(!r.ok && auth.charged) refundCredits(auth.customerId,auth.charged);
      const ct=r.headers.get('content-type')||'text/event-stream'; res.writeHead(r.status,{'Content-Type':ct,'Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});
      if(!r.body)return res.end(); const reader=r.body.getReader(); while(true){const {value,done}=await reader.read();if(done)break;res.write(Buffer.from(value));} return res.end();
    }
    if(u.pathname==='/v1/images/generations') { try{return await pixazoImage(res,data,false)}catch(e){if(auth.charged)refundCredits(auth.customerId,auth.charged);throw e;} }
    if(u.pathname==='/v1/images/edits') { try{return await pixazoImage(res,data,true)}catch(e){if(auth.charged)refundCredits(auth.customerId,auth.charged);throw e;} }
    if(u.pathname==='/v1/search'){
      if(!TAVILY){if(auth.charged)refundCredits(auth.customerId,auth.charged);return send(res,503,{status:false,error:'TAVILY_API_KEY belum dikonfigurasi di VPS'});}
      const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:TAVILY,query:String(data.query||data.question||''),search_depth:'basic',max_results:6})});
      if(!r.ok && auth.charged) refundCredits(auth.customerId,auth.charged); return send(res,r.status,await r.text());
    }
    return send(res,404,{status:false,error:'Route Not Found'});
  }catch(e){return send(res,502,{status:false,error:e.message||'Gateway error'});}
});
server.listen(PORT,'0.0.0.0',()=>{console.log(`ONYX Gateway (single VPS) listening on :${PORT}`);});
