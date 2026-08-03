const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const TARGET_PORT = process.env.TARGET_PORT || 3003;
const PROXY_PORT = process.env.PROXY_PORT || 3004;

const logStream = fs.createWriteStream('/workspace/project/audio-scope-view/debug-proxy.log', { flags: 'a' });

function log(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(' ')}`;
  console.log(message);
  logStream.write(message + '\n');
}

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;
  
  log(`==> ${method} ${url}`);
  
  // Log headers
  log(`    Headers: ${JSON.stringify(req.headers)}`);
  
  // Proxy the request
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: TARGET_PORT,
      path: url,
      method: method,
      headers: {
        ...req.headers,
        'X-Debug-Proxy': 'true',
      },
    },
    (proxyRes) => {
      log(`<== ${proxyRes.statusCode} ${url}`);
      log(`    Response Headers: ${JSON.stringify(proxyRes.headers)}`);
      
      // For streaming responses, we need to see the data
      const contentType = proxyRes.headers['content-type'] || '';
      const isStreaming = contentType.includes('audio') || 
                          contentType.includes('octet-stream') ||
                          url.includes('/stream');
      
      if (isStreaming) {
        log(`    [STREAMING RESPONSE - will capture chunks]`);
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        let chunkCount = 0;
        proxyRes.on('data', (chunk) => {
          chunkCount++;
          if (chunkCount <= 5) {
            log(`    [STREAM CHUNK ${chunkCount}] Size: ${chunk.length} bytes`);
          }
        });
        
        proxyRes.on('end', () => {
          log(`    [STREAM END] Total chunks: ${chunkCount}`);
        });
        
        proxyRes.pipe(res);
      } else {
        let body = '';
        proxyRes.on('data', (chunk) => {
          body += chunk.toString();
        });
        proxyRes.on('end', () => {
          if (body.length < 5000) {
            log(`    Body: ${body.substring(0, 2000)}`);
          } else {
            log(`    Body length: ${body.length} bytes`);
            log(`    Body preview: ${body.substring(0, 500)}...`);
          }
        });
        
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    }
  );
  
  proxyReq.on('error', (err) => {
    log(`[ERROR] Proxy error: ${err.message}`);
    res.writeHead(502);
    res.end('Proxy Error');
  });
  
  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  log(`Debug proxy running on http://localhost:${PROXY_PORT}`);
  log(`Proxying to http://localhost:${TARGET_PORT}`);
  log(`All requests will be logged to debug-proxy.log`);
});
