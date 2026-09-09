import server from '../../dist/server/server.js';

export default async (request, context) => {
  let req = request;

  if (req && typeof req.url === 'string' && !req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    const headers = req.headers instanceof Headers ? req.headers : new Headers(req.headers || {});
    const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost';
    const proto = headers.get('x-forwarded-proto') || 'https';
    const fullUrl = `${proto}://${host}${req.url.startsWith('/') ? '' : '/'}${req.url}`;

    if (typeof Request !== 'undefined' && req instanceof Request) {
      req = new Request(fullUrl, req);
    } else {
      req = new Request(fullUrl, {
        method: req.method || 'GET',
        headers: headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      });
    }
  }

  return server.fetch(req, undefined, context);
};

