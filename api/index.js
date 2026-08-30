/**
 * Root API route
 * Redirect & serve info
 */

export default (req, res) => {
  // Redirect api-docs.html ke /api/docs
  if (req.url === '/api-docs.html' || req.url === '/api-docs') {
    res.writeHead(301, { Location: '/api/docs' });
    res.end();
    return;
  }

  // Info endpoint
  const info = {
    name: 'ONYX AI',
    version: '1.0',
    status: 'running',
    endpoints: {
      chat: '/api/chat',
      upload: '/api/upload-image',
      edit: '/api/edit-photo',
      generate: '/api/generate-image',
      iqc: '/api/iqc',
      health: '/api/health',
      docs: '/api/docs'
    },
    docs_url: '/api/docs'
  };

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(info);
};
