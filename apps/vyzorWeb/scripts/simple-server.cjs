const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const WEB_DIR = path.join(__dirname, '../dist/client');
const API_DIR = path.join(__dirname, '../../packages/api-client/dist');
const GRAPHQL_SERVER = 'http://127.0.0.1:8080';
const WS_SERVER = 'ws://127.0.0.1:8080';
const BOOTSTRAP_KEY = process.env.BOOTSTRAP_KEY;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = req.url;
  console.log(`[REQUEST] ${req.method} ${url}`);
  
  let urlPath = url.split('?')[0];
  
  // Health check endpoint
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Yes am alive');
    return;
  }

  // Proxy GraphQL requests to Rust server
  if (urlPath.startsWith('/graphql')) {
    console.log(`  -> Proxying to GraphQL server: ${GRAPHQL_SERVER}${urlPath}`);
    const proxyReq = http.request(
      `${GRAPHQL_SERVER}${urlPath}`,
      {
        method: req.method,
        headers: {
          ...req.headers,
          'Host': '127.0.0.1:8080',
          'Authorization': `Bearer ${BOOTSTRAP_KEY}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      console.log(`  -> Proxy error: ${err.message}`);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq);
    return;
  }
  
  // Proxy API requests to Rust server (for recording streaming, metadata, etc.)
  if (urlPath.startsWith('/api/')) {
    console.log(`  -> Proxying to API server: ${GRAPHQL_SERVER}${urlPath}`);
    const proxyReq = http.request(
      `${GRAPHQL_SERVER}${urlPath}`,
      {
        method: req.method,
        headers: {
          ...req.headers,
          'Host': '127.0.0.1:8080',
          'Authorization': `Bearer ${BOOTSTRAP_KEY}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      console.log(`  -> Proxy error: ${err.message}`);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    req.pipe(proxyReq);
    return;
  }
  
  // API client requests
  if (urlPath.startsWith('/api-client/')) {
    const filePath = path.join(API_DIR, urlPath.replace('/api-client/', ''));
    console.log(`  -> Serving API client: ${filePath}`);
    serveFile(filePath, res);
    return;
  }
  
  // Any assets request - extract the /assets/... part and serve from web dist
  // This handles /scope/assets/... as well as /assets/...
  const assetsMatch = urlPath.match(/\/assets\/(.+)$/);
  if (assetsMatch) {
    const assetPath = '/assets/' + assetsMatch[1];
    const filePath = path.join(WEB_DIR, assetPath);
    console.log(`  -> Asset request (normalized): ${filePath}`);
    serveFile(filePath, res);
    return;
  }
  
  // Web app requests - SPA routing for paths like /scope/xxx
  let filePath = path.join(WEB_DIR, urlPath);
  const extname = path.extname(urlPath);
  
  // Check if this is a file request (has extension)
  const isFileRequest = extname && extname.length > 0;
  
  // If no extension, serve index.html for SPA
  if (!isFileRequest) {
    filePath = path.join(WEB_DIR, 'index.html');
    console.log(`  -> SPA routing, serving: ${filePath}`);
  } else {
    console.log(`  -> File request: ${filePath}`);
  }
  
  serveFile(filePath, res);
});

function serveFile(filePath, res) {
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`  -> File not found: ${filePath}`);
        // Fallback to index.html for SPA routing
        const indexPath = path.join(WEB_DIR, 'index.html');
        console.log(`  -> Trying fallback: ${indexPath}`);
        fs.readFile(indexPath, (idxErr, idxContent) => {
          if (idxErr) {
            console.log(`  -> Fallback also failed: ${idxErr.message}`);
            res.writeHead(404);
            res.end('Not Found');
          } else {
            console.log(`  -> Serving fallback index.html`);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(idxContent);
          }
        });
      } else {
        console.log(`  -> Server error: ${err.message}`);
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      console.log(`  -> Serving: ${filePath} (${contentType})`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// WebSocket proxy
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url;
  console.log(`[WS UPGRADE] ${url}`);
  
  if (url.startsWith('/ws')) {
    // Proxy WebSocket to Rust server
    const targetUrl = `${WS_SERVER}${url}`;
    console.log(`  -> Proxying WebSocket to: ${targetUrl}`);
    
    const proxyReq = http.request({
      method: 'GET',
      headers: {
        ...request.headers,
        'Host': '127.0.0.1:8080',
        'Authorization': `Bearer ${BOOTSTRAP_KEY}`,
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      },
      path: url,
      host: '127.0.0.1',
    }, (proxyRes) => {
      console.log(`  -> Proxy response status: ${proxyRes.statusCode}`);
    });
    
    proxyReq.on('error', (err) => {
      console.log(`  -> WebSocket proxy error: ${err.message}`);
      socket.destroy();
    });
    
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      // Handle WebSocket upgrade response
      const headers = proxyRes.headers;
      const key = request.headers['sec-websocket-key'];
      const version = request.headers['sec-websocket-version'];
      
      // Build upgrade response manually
      const respHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Accept: ${headers['sec-websocket-accept'] || ''}`,
        ``,
        ``
      ].join('\r\n');
      
      socket.write(respHeaders);
      
      // Pipe proxy socket to client socket
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      
      proxySocket.on('error', (err) => {
        console.log(`  -> Proxy socket error: ${err.message}`);
        socket.destroy();
      });
      
      socket.on('error', (err) => {
        console.log(`  -> Client socket error: ${err.message}`);
        proxySocket.destroy();
      });
    });
    
    proxyReq.end();
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => console.log(`\nServer running on http://localhost:${PORT}`));
console.log(`Serving web from: ${WEB_DIR}`);
console.log(`Serving API client from: ${API_DIR}\n`);
console.log(`WebSocket proxy enabled for /ws endpoint\n`);
