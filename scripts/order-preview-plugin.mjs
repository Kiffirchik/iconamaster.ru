// Local development only. Never sends mail and always labels the preview response.
export function orderPreviewPlugin() {
  const install = (server) => { server.middlewares.use('/order-request.php', (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET') return response.end(JSON.stringify({ preview: true, csrf: 'local-preview', requestId: '00000000000000000000000000000000' }));
    if (request.method === 'POST') {
      request.resume();
      return response.end(JSON.stringify({ ok: true, preview: true }));
    }
    response.statusCode = 405; response.end(JSON.stringify({ ok: false }));
  }); };
  return { name: 'local-order-preview', configureServer: install, configurePreviewServer: install };
}
