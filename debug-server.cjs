const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB_DIR = path.join(__dirname, 'apps/vyzorWeb/dist/client');
const API_DIR = path.join(__dirname, 'packages/api-client/dist');
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

// Activity logger
function log(type, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}]`, ...args);
}

// Create debug HTTP agent with logging
const httpAgent = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;
  
  log('REQUEST', `${method} ${url}`);
  
  // Log headers
  log('HEADERS', JSON.stringify(req.headers, null, 2));
  
  let urlPath = url.split('?')[0];
  
  // Health check endpoint
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Debug server alive');
    return;
  }

  // Capture body for POST requests
  let body = [];
  req.on('data', chunk => {
    body.push(chunk);
  });
  
  req.on('end', () => {
    if (body.length > 0) {
      const bodyStr = Buffer.concat(body).toString();
      log('BODY', bodyStr.substring(0, 1000)); // Limit log size
    }
    
    // Proxy GraphQL requests to Rust server
    if (urlPath.startsWith('/graphql')) {
      log('GRAPHQL_PROXY', `-> ${GRAPHQL_SERVER}${urlPath}`);
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
          log('GRAPHQL_RESPONSE', `${proxyRes.statusCode}`);
          log('GRAPHQL_HEADERS', JSON.stringify(proxyRes.headers, null, 2));
          
          let responseBody = [];
          proxyRes.on('data', chunk => responseBody.push(chunk));
          proxyRes.on('end', () => {
            const respBody = Buffer.concat(responseBody).toString();
            log('GRAPHQL_BODY', respBody.substring(0, 2000));
            
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(respBody);
          });
        }
      );
      proxyReq.on('error', (err) => {
        log('GRAPHQL_ERROR', err.message);
        res.writeHead(502);
        res.end('Bad Gateway');
      });
      
      if (body.length > 0) {
        proxyReq.write(Buffer.concat(body));
      }
      proxyReq.end();
      return;
    }
    
    // Proxy API requests to Rust server
    if (urlPath.startsWith('/api/')) {
      log('API_PROXY', `-> ${GRAPHQL_SERVER}${urlPath}`);
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
          log('API_RESPONSE', `${proxyRes.statusCode}`);
          
          let responseBody = [];
          proxyRes.on('data', chunk => responseBody.push(chunk));
          proxyRes.on('end', () => {
            const respBody = Buffer.concat(responseBody).toString();
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(respBody);
          });
        }
      );
      proxyReq.on('error', (err) => {
        log('API_ERROR', err.message);
        res.writeHead(502);
        res.end('Bad Gateway');
      });
      
      if (body.length > 0) {
        proxyReq.write(Buffer.concat(body));
      }
      proxyReq.end();
      return;
    }
    
    // API client requests
    if (urlPath.startsWith('/api-client/')) {
      const filePath = path.join(API_DIR, urlPath.replace('/api-client/', ''));
      log('API_CLIENT', `Serving: ${filePath}`);
      serveFile(filePath, res);
      return;
    }
    
    // Assets request
    const assetsMatch = urlPath.match(/\/assets\/(.+)$/);
    if (assetsMatch) {
      const assetPath = '/assets/' + assetsMatch[1];
      const filePath = path.join(WEB_DIR, assetPath);
      log('ASSET', `Serving: ${filePath}`);
      serveFile(filePath, res);
      return;
    }
    
    // Web app requests - SPA routing
    let filePath = path.join(WEB_DIR, urlPath);
    const extname = path.extname(urlPath);
    const isFileRequest = extname && extname.length > 0;
    
    if (!isFileRequest) {
      filePath = path.join(WEB_DIR, 'index.html');
      log('SPA', `Routing, serving: ${filePath}`);
    } else {
      log('FILE', `Serving: ${filePath}`);
    }
    
    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  log('SERVE_FILE', filePath, contentType);
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        log('NOT_FOUND', filePath);
        // Fallback to index.html
        const indexPath = path.join(WEB_DIR, 'index.html');
        log('FALLBACK', indexPath);
        fs.readFile(indexPath, (idxErr, idxContent) => {
          if (idxErr) {
            log('FALLBACK_ERROR', idxErr.message);
            res.writeHead(404);
            res.end('Not Found');
          } else {
            log('FALLBACK_SUCCESS');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(idxContent);
          }
        });
      } else {
        log('SERVER_ERROR', err.message);
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      log('SUCCESS', `${filePath} (${contentType}) - ${content.length} bytes`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const PORT = process.env.PORT || 3003;
httpAgent.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  DEBUG SERVER - Logging all activity');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving web from: ${WEB_DIR}`);
  console.log(`GraphQL proxy: ${GRAPHQL_SERVER}`);
  console.log('='.repeat(60) + '\n');
});
