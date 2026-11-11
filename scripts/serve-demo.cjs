/** 本地静态服务：把仓库根目录挂到 127.0.0.1:8173 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PORT = 8173
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' }

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const rel = url === '/' ? '/demo/index.html' : url
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}).listen(PORT, '127.0.0.1', () => {
  console.log('demo → http://127.0.0.1:' + PORT + '/demo/')
})
