/**
 * API Documentation endpoint
 * Akses via: /api/docs
 */

export default (req, res) => {
  // Optional: Check auth header if needed
  // const auth = req.headers.authorization;
  // if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const docs = {
    title: 'ONYX AI API Documentation',
    version: '1.0.0',
    baseUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
    endpoints: [
      {
        method: 'POST',
        path: '/api/chat',
        description: 'Chat dengan AI',
        body: { question: 'string' },
        response: { status: 'boolean', result: 'string' }
      },
      {
        method: 'POST',
        path: '/api/upload-image',
        description: 'Upload image ke server',
        body: { form_data: 'multipart/form-data dengan field file: image/*' },
        response: { status: 'boolean', url: 'string' }
      },
      {
        method: 'POST',
        path: '/api/edit-photo',
        description: 'Edit foto (enhance, blur, sharpen, grayscale)',
        body: { image: 'base64', operation: 'enhance|blur|sharpen|grayscale' },
        response: { status: 'boolean', image: 'base64_url' }
      },
      {
        method: 'POST',
        path: '/api/generate-image',
        description: 'Generate image dari text prompt via Cloudflare AI / xai/grok-imagine-image-2.0',
        body: { prompt: 'string' },
        response: { status: 'boolean', image: 'url' }
      },
      {
        method: 'GET',
        path: '/api/health',
        description: 'Health check',
        response: { status: 'ok|loading', message: 'string' }
      }
    ]
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(docs);
};
