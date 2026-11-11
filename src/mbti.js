/**
 * MBTI 计分逻辑 —— 只有数学，没有内容。
 *
 * 题目文案与权重全部来自 AI 生成的题库（utils/ai-bank.js 种子 + 云端 quiz_bank 池）。
 * 本文件只负责从答案算出类型。
 *
 * 计分（动态题库版，docs/dynamic-quiz-rules.md）：
 *   每题不是一票，而是 weight 换算出的倍率票（1-5 → 0.6/0.8/1.0/1.25/1.5，
 *   维内做 60% 占比削峰，见 utils/quiz.js）。加权多数才翻向第二极，平手按第一极。
 *   强度 = 50 + |W第一极 − W第二极| / (W第一极 + W第二极) × 50 → 连续 50-100。
 *   等权时与旧版逐点一致：全选第一极 = ESTJ / 全第二极 = INFP / 3:1 = 75 / 2:2 = 50。
 */

const bank = require('./ai-bank')
const quiz = require('./quiz')

const QUESTIONS = bank.mbti

const LETTERS = {
  ei: ['E', 'I'],
  sn: ['S', 'N'],
  tf: ['T', 'F'],
  jp: ['J', 'P']
}

const DIM_DESC = {
  ei: { 0: '向外充电', 1: '向内充电' },
  sn: { 0: '关注实感', 1: '关注可能' },
  tf: { 0: '用逻辑决策', 1: '用感受决策' },
  jp: { 0: '偏好计划', 1: '偏好灵活' }
}

/**
 * @param {number[]} answers  与 questions 等长，每题 0（第一极）或 1（第二极）
 * @param {object[]} [questions]  本卷实际出的题（缺省 = 种子整库）
 * @returns {{mbti:string, axes:object, axisScores:object, qweights:object}}
 *   qweights[k] = 该维本卷均权（随档案入云，relation.js 用它调扣分力度）
 */
function score(answers, questions) {
  const qs = questions || QUESTIONS
  const axes = {}
  const axisScores = {}
  const qweights = {}
  let mbti = ''

  Object.keys(LETTERS).forEach((k) => {
    const rows = []
    qs.forEach((q, i) => {
      if (q.key !== k) return
      const a = answers[i] === 1 ? 1 : 0
      rows.push({ a: a, w: quiz.qWeight(q) })
    })
    if (!rows.length) {
      axes[k] = 0
      axisScores[k] = 50
      qweights[k] = 1
      mbti += LETTERS[k][0]
      return
    }
    const balanced = quiz.balanceWeights(rows.map((r) => r.w))
    let w0 = 0
    let w1 = 0
    let wsum = 0
    rows.forEach((r, i) => {
      if (r.a === 1) w1 += balanced[i]
      else w0 += balanced[i]
      wsum += balanced[i]
    })
    const second = w1 > w0   // 加权平手按第一极，与「全选第一项 = ESTJ」锚定一致
    axes[k] = second ? 1 : 0
    axisScores[k] = wsum > 0 ? Math.round(50 + Math.abs(w0 - w1) / wsum * 50) : 50
    qweights[k] = Math.round((wsum / rows.length) * 100) / 100
    mbti += LETTERS[k][second ? 1 : 0]
  })

  return { mbti: mbti, axes: axes, axisScores: axisScores, qweights: qweights }
}

/** 每维偏向的中文短语（与 persona.AXIS_META 的极点名一致） */
function describe(axes) {
  const out = {}
  Object.keys(LETTERS).forEach((k) => {
    out[k] = DIM_DESC[k][axes[k] === 1 ? 1 : 0]
  })
  return out
}

module.exports = { QUESTIONS, LETTERS, DIM_DESC, score, describe }
