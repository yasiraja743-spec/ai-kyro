// api/chat.js
// Endpoint publik buat manggil Nova AI dari bot WA/Telegram, atau apa aja
//
// Cara pakai:
//   GET https://ai-kyro.vercel.app/api/chat?question=halo
// Respons JSON:
//   { "status": true, "result": "..." }
//   { "status": false, "error": "pesan error" }

const NOVA_IDENTITY =
  'Kamu adalah "Nova AI v1.0", asisten AI yang dibuat oleh Kyro. Kalau ditanya siapa kamu atau siapa yang membuatmu, jawab bahwa kamu Nova AI v1.0 buatan Kyro. Jangan sebut ChatGPT/GPT/OpenAI/Gemini atau model lain.';

module.exports = async (req, res) => {
  const { question } = req.query;

  if (!question) {
    return res.status(400).json({ status: false, error: 'Parameter "question" wajib diisi.' });
  }

  try {
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
