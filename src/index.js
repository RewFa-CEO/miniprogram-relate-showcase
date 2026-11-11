/**
 * 认识 TA · 公开切片的统一入口。
 *
 * 这个仓库只公开「算法层」：3D 投影引擎、题库计分、双人对照。
 * 应用外壳、云函数、AI 编排、知识库全文都不在公开范围内（见 docs/SLICE.md）。
 */

const chart3d = require('./chart3d')
const persona = require('./persona')
const quiz = require('./quiz')
const aiBank = require('./ai-bank')
const mbti = require('./mbti')
const style = require('./style')
const relation = require('./relation')
const tone = require('./tone')

module.exports = {
  chart3d,
  persona,
  quiz,
  aiBank,
  mbti,
  style,
  relation,
  tone
}
