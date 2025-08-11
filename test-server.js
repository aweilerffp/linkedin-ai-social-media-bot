const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.url}`);
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Direct Server Test</title>
</head>
<body>
    <h1>Direct Node.js Server Test</h1>
    <div id="test">JavaScript test...</div>
    <script>
        document.getElementById('test').innerHTML = '✅ JavaScript is working!';
        console.log('JavaScript executed');
    </script>
</body>
</html>
    `);
  } else if (req.url === '/react-test') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>React CDN Test</title>
</head>
<body>
    <div id="root"></div>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script>
        const e = React.createElement;
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(e('h1', null, '✅ React from CDN works!'));
    </script>
</body>
</html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://0.0.0.0:${PORT}`);
  console.log('Visit:');
  console.log(`  http://5.78.46.19:${PORT}/ - Basic JavaScript test`);
  console.log(`  http://5.78.46.19:${PORT}/react-test - React CDN test`);
});