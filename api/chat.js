const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

const NOVA_IDENTITY =
  'Kamu adalah "Nova AI v1.0", asisten AI yang dibuat oleh Kyro. Kalau ditanya siapa kamu atau siapa yang membuatmu, jawab bahwa kamu Nova AI v1.0 buatan Kyro. Jangan sebut ChatGPT/GPT/OpenAI/Gemini atau model lain.';

module.exports = async (req, res) => {
  const { key, question } = req.query;

  if (!key || !question) {
    return res.status(400).json({ status: false, error: 'Parameter "key" dan "question" wajib diisi.' });
  }

  try {
    const db = admin.firestore();
    const keyDoc = await db.collection('apiKeys').doc(String(key)).get();

    if (!keyDoc.exists) {
      return res.status(401).json({ status: false, error: 'API key tidak valid.' });
    }

    const prompt = `${NOVA_IDENTITY}\nUser: ${question}\nNova:`;
    const apiRes = await fetch(
      `https://api.ikyyxd.my.id/ai/gpt-5-mini?question=${encodeURIComponent(prompt)}`
    );
    const data = await apiRes.json();

    return res.status(200).json({ status: true, result: data.result || '' });
  } catch (e) {
    console.error('chat endpoint error:', e);
    return res.status(500).json({ status: false, error: 'Terjadi kesalahan di server.' });
  }
};
