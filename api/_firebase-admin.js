import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function adminAuth(){
  if(!getApps().length){
    const projectId=process.env.FIREBASE_PROJECT_ID;
    const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey=(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
    if(!projectId||!clientEmail||!privateKey) throw new Error('Firebase Admin belum dikonfigurasi di Vercel. Isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
    initializeApp({credential:cert({projectId,clientEmail,privateKey})});
  }
  return getAuth();
}

export async function requireFirebaseUser(req){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')) throw Object.assign(new Error('Login Firebase diperlukan'),{statusCode:401});
  try { return await adminAuth().verifyIdToken(h.slice(7).trim()); }
  catch { throw Object.assign(new Error('Sesi login Firebase tidak valid atau sudah kedaluwarsa'),{statusCode:401}); }
}
