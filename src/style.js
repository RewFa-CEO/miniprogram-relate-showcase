/**
 * 沟通风格 + 关系需求 —— 只有结构和计分，没有内容。
 *
 * 题目/选项文案与权重全部来自 AI 生成的题库（utils/ai-bank.js 种子 + 云端 quiz_bank 池）。
 * 风格：6 维，每维 0-3 四档（行为强度，不是二选一）。
 * 需求：4 组二选一（选项的完整表述与 2 字短标签都由 AI 生成；同组题的 tag 族固定）。
 *
 * 动态题库计分（docs/dynamic-quiz-rules.md）：
 *   一维出了多道题时，档位 = 加权平均（round 后仍落 0-3 整档），
 *   需求组 = 加权投票（平手按锚题一侧）。
 *   qweights 返回每维均权，随档案入云，relation.js 用它调差异扣分力度。
 */

const bank = require('./ai-bank')
const quiz = require('./quiz')

const STYLE_QUESTIONS = bank.style
const NEED_GROUPS = bank.need

function round2(x) {
  return Math.round(x * 100) / 100
}

/**
 * @param {number[]} styleAns  与 styleQs 等长，每题 0-3
 * @param {number[]} needAns   与 needQs 等长，每组 0/1
 * @param {object[]} [styleQs] 本卷实际出的风格题（缺省 = 种子整库）
 * @param {object[]} [needQs]  本卷实际出的需求题（缺省 = 种子整库）
 * @returns {{style:object, need:object, needTags:string[], qweights:object}}
 */
function score(styleAns, needAns, styleQs, needQs) {
  const sq = styleQs && styleQs.length ? styleQs : STYLE_QUESTIONS
  const nq = needQs && needQs.length ? needQs : NEED_GROUPS

  // 风格：按维聚合（一维可能出 1-2 题）
  const styleAgg = {}
  sq.forEach((q, i) => {
    const v = styleAns[i]
    if (typeof v !== 'number' || v < 0) return
    const g = styleAgg[q.key] || (styleAgg[q.key] = { rows: [] })
    g.rows.push({ v: v, w: quiz.qWeight(q) })
  })
  const style = {}
  Object.keys(styleAgg).forEach((k) => {
    const g = styleAgg[k]
    const ws = quiz.balanceWeights(g.rows.map((r) => r.w))
    let wv = 0
    let wsum = 0
    g.rows.forEach((r, i) => {
      wv += r.v * ws[i]
      wsum += ws[i]
    })
    const level = wsum > 0 ? Math.round(wv / wsum) : 0
    style[k] = Math.max(0, Math.min(3, level))
    styleAgg[k].mean = wsum > 0 ? round2(wsum / g.rows.length) : 1
  })

  // 需求：按组加权投票（平手按第一题=锚题一侧）
  const needAgg = {}
  nq.forEach((q, i) => {
    const v = needAns[i]
    if (v !== 0 && v !== 1) return
    const g = needAgg[q.key] || (needAgg[q.key] = { rows: [], first: q })
    g.rows.push({ v: v, w: quiz.qWeight(q) })
  })
  const need = {}
  const needTags = []
  Object.keys(needAgg).forEach((k) => {
    const g = needAgg[k]
    const ws = quiz.balanceWeights(g.rows.map((r) => r.w))
    let w0 = 0
    let w1 = 0
    let wsum = 0
    g.rows.forEach((r, i) => {
      if (r.v === 1) w1 += ws[i]
      else w0 += ws[i]
      wsum += ws[i]
    })
    const pick = w1 > w0 ? 1 : 0
    need[k] = pick
    // tag 取自本卷第一题（组卷保证锚题优先在首位；同组 tag 族由生成闸锁定一致）
    needTags.push(g.first.options[pick].tag)
    needAgg[k].mean = wsum > 0 ? round2(wsum / g.rows.length) : 1
  })

  const qweights = {}
  Object.keys(styleAgg).forEach((k) => { qweights[k] = styleAgg[k].mean })
  Object.keys(needAgg).forEach((k) => { qweights[k] = needAgg[k].mean })

  return { style: style, need: need, needTags: needTags, qweights: qweights }
}

/** 档案页沟通节奏标签：直接用各维当前档位的完整选项文字 */
function styleTags(style) {
  const s = style || {}
  return STYLE_QUESTIONS.map((q) => {
    const v = s[q.key]
    return typeof v === 'number' ? q.options[v] : ''
  }).filter(Boolean)
}

module.exports = { STYLE_QUESTIONS, NEED_GROUPS, score, styleTags }
