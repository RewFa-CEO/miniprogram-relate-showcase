/**
 * 把 CommonJS 的 src/ 打成一个能在浏览器直接 <script> 引入的 demo/bundle.js。
 *
 * 只做依赖替换，不做转译 —— 目标是「让人看见的代码和仓库里的代码是同一份」。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

// 依赖顺序：被依赖的先声明
const ORDER = ['ai-bank', 'quiz', 'chart3d', 'persona', 'mbti', 'style', 'relation', 'tone']

const banner = `/* 认识 TA · 公开切片 demo bundle —— 由 scripts/build-demo.cjs 生成，勿手改。
   源文件见 src/，逐字未改；这里只把 require('./x') 换成模块表引用。 */
`

const parts = [banner]
const names = {}

for (const name of ORDER) {
  const file = path.join(SRC, name + '.js')
  let code = fs.readFileSync(file, 'utf8')
  // require('./ai-bank') -> __mod_ai_bank
  code = code.replace(/require\('\.\/([\w-]+)'\)/g, (m, dep) => {
    const key = '__mod_' + dep.replace(/-/g, '_')
    if (!names[dep]) throw new Error('模块顺序有误：' + dep + ' 未先声明')
    return key
  })
  const key = '__mod_' + name.replace(/-/g, '_')
  names[name] = key
  parts.push(
    `const ${key} = (function () {\n` +
    `  const module = { exports: {} };\n` +
    `  const exports = module.exports;\n` +
    code +
    `\n  return module.exports;\n` +
    `})();\n`
  )
}

parts.push(
  `\nwindow.RELATE = {\n` +
  ORDER.map((n) => `  ${n.replace(/-/g, '_')}: ${names[n]}`).join(',\n') +
  `\n};\n`
)

const out = path.join(ROOT, 'demo', 'bundle.js')
fs.writeFileSync(out, parts.join('\n'), 'utf8')
console.log('wrote', path.relative(ROOT, out), fs.statSync(out).size, 'bytes')
