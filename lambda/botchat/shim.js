/*
 * Adapts a Vercel-style `(req, res) => {...}` serverless handler to run
 * unmodified behind a Lambda Function URL. Mirrors the two things Vercel
 * gives those handlers for free: JSON bodies pre-parsed onto `req.body`,
 * and raw bodies readable via `req.on('data'|'end')`.
 */
function buildReq(event) {
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;

  let bodyBuf = Buffer.alloc(0);
  if (event.body != null) {
    bodyBuf = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8');
  }

  let parsedBody;
  const contentType = headers['content-type'] || '';
  if (bodyBuf.length && contentType.includes('application/json')) {
    try { parsedBody = JSON.parse(bodyBuf.toString('utf8')); } catch { /* leave undefined */ }
  }

  const listeners = {};
  const req = {
    method: event.requestContext?.http?.method || 'GET',
    headers,
    body: parsedBody,
    on(evt, cb) {
      (listeners[evt] = listeners[evt] || []).push(cb);
      return req;
    },
  };

  process.nextTick(() => {
    if (bodyBuf.length) (listeners.data || []).forEach(cb => cb(bodyBuf));
    (listeners.end || []).forEach(cb => cb());
  });

  return req;
}

function buildRes() {
  let resolve;
  const done = new Promise(r => { resolve = r; });
  const res = {
    _statusCode: 200,
    _headers: {},
    _body: '',
    _isBase64: false,
    setHeader(k, v) { res._headers[k] = v; return res; },
    status(code) { res._statusCode = code; return res; },
    json(obj) {
      res.setHeader('Content-Type', 'application/json');
      res._body = JSON.stringify(obj);
      resolve();
      return res;
    },
    send(data) {
      if (Buffer.isBuffer(data)) {
        res._isBase64 = true;
        res._body = data.toString('base64');
      } else if (data && typeof data === 'object') {
        return res.json(data);
      } else {
        res._body = data == null ? '' : String(data);
      }
      resolve();
      return res;
    },
  };
  res._done = done;
  return res;
}

async function runHandler(handler, event) {
  const req = buildReq(event);
  const res = buildRes();
  await Promise.race([handler(req, res), res._done]);
  await res._done;
  return {
    statusCode: res._statusCode,
    headers: res._headers,
    body: res._body,
    isBase64Encoded: res._isBase64,
  };
}

module.exports = { runHandler };
