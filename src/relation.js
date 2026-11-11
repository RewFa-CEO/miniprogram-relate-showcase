/**
 * 关系算法：把两份档案摆在一起，算出结构化的对照结果。
 *
 * 本文件只产出**结构与数字**：哪几维不同、差多少、参考分多少。
 * 所有人类可读的解读文字（note / advice / 建议）一律不在这里 ——
 * 它们由云端 AI（MiniMax）基于本结构生成并缓存（见 cloudfunctions ai.js），
 * 本地开发模式下页面显示「AI 解读需要云端」的占位，不放假文字。
 *
 * 差异触发条件（可解释的判定规则）：
 *   mbti  某维偏向不同（axes 不相等）
 *   style 某维档位差 ≥ 2
 *   need  某组选择不同
 * 扣分/加分力度 = 基数表 × 该维 AI 权重（档案 qweights，动态题库见 docs/dynamic-quiz-rules.md）
 * 完全相同的两份档案 → 0 条差异（verify.py 有锚定测试）。
 */

const STYLE_QUESTIONS = require('./style').STYLE_QUESTIONS
const NEED_GROUPS = require('./style').NEED_GROUPS
const AXIS_META = require('./persona').AXIS_META

/**
 * 关系类型：这段关系**是什么**。
 *
 * 为什么放在「关系」而不是「个人」：一个人可以同时有恋爱、暧昧、朋友、兄弟多段关系
 * （席位制正好承载多段）。个人档案（性格/风格/需求）是我这个人，关系类型是**我们俩**。
 * 发起邀请的人定义这段关系是什么，接受方继承。
 *
 * 语气：白话，不解释术语，不喊口号。
 */
const RELATION_TYPES = [
  { key: 'romance', label: '恋人', hint: '在一起，或正在决定要不要在一起' },
  { key: 'crush', label: '暧昧', hint: '互相有意思，但谁都没先说破' },
  { key: 'friend', label: '朋友', hint: '聊得来，想再近一步' },
  { key: 'brother', label: '兄弟', hint: '铁到不用说，也想被理解' },
  { key: 'buddy', label: '搭子', hint: '一起做事，一起扛' }
]

/** 老关系（没有 relationType 字段）统一按这个类型兜底 */
const DEFAULT_RELATION_TYPE = 'romance'

/** 关系类型的展示名；未知类型退回默认（不猜、不报错） */
function relationTypeLabel(key) {
  const t = RELATION_TYPES.find((x) => x.key === key)
  return t ? t.label : relationTypeLabel(DEFAULT_RELATION_TYPE)
}

/**
 * 关系标签：这段关系的社交货币 —— 一个能念出来、能转发的定性词。
 *
 * 它压缩的是**结构事实**（差异落在哪一族、有几处），不是判决：
 * 不下「合不合适」「能不能长久」的定论，不用命理词，不预测结局。
 * 规则固定可解释：同一份对照结果永远得到同一个标签。
 *
 * 为什么需要它：竞品能分享单人的性格结果，分享不了「两个人之间是什么关系」。
 * 一个可转发的标签，比一个分数更能让人想转发 —— 分数是给当事人看的，标签是给别人看的。
 */
const RELATION_TAGS = [
  { key: 'sync', tag: '同频', line: '你俩大部分时候站在同一边' },
  { key: 'offbeat', tag: '错拍', line: '你俩说话不在一个节拍上' },
  { key: 'contrast', tag: '反差', line: '一个想被看见，一个习惯不说' },
  { key: 'parallel', tag: '平行', line: '你们各自一套，谁也不必迁就谁' }
]

/** 差异归族：决定「落差主要落在哪一块」 */
function diffFamily(d) {
  if (d.kind === 'mbti') return (d.key === 'ei' || d.key === 'tf') ? 'love' : 'live'
  if (d.kind === 'style') {
    return ['express', 'reply', 'emotion', 'conflict', 'initiative'].indexOf(d.key) >= 0 ? 'communicate' : 'live'
  }
  if (d.kind === 'need') return (d.key === 'recognition' || d.key === 'support') ? 'love' : 'live'
  return 'live'
}

/**
 * 从对照结果算出关系标签。
 * @param {object} report analyze() 的产物
 * @param {string} relType 关系类型（恋人/暧昧/朋友/兄弟/搭子）
 * @returns {{key, tag, line, type}}
 */
function relationTag(report, relType) {
  const type = relationTypeLabel(relType)
  if (!report) return { key: '', tag: '', line: '', type: type }
  const diffs = report.diffs || []
  const count = { love: 0, communicate: 0, live: 0 }
  diffs.forEach((d) => { count[diffFamily(d)] = (count[diffFamily(d)] || 0) + 1 })

  let key = 'parallel'
  if (diffs.length <= 2) key = 'sync'
  else if (count.communicate >= count.love && count.communicate >= count.live) key = 'offbeat'
  else if (count.love > count.communicate && count.love > count.live) key = 'contrast'

  const t = RELATION_TAGS.find((x) => x.key === key)
  return { key: key, tag: t.tag, line: t.line, type: type }
}

const DIMS_META = [
  { key: 'love', label: '感情', desc: '情绪的相互可见度与被认可的方式' },
  { key: 'communicate', label: '沟通', desc: '表达、回应与冲突处理的节奏差' },
  { key: 'live', label: '生活', desc: '日常秩序与注意力分配的合拍程度' },
  { key: 'grow', label: '成长', desc: '彼此给对方留出的变化空间' }
]

/**
 * 题目的 AI 权重（0.6-1.5 倍率，存于档案 qweights）调扣分/加分力度：
 * AI 认为信息量大的题，双方答出差异时扣分更重、答出一致时加分更多。
 * 旧档案没有 qweights → 一律按 1.0，行为与历史完全一致。
 */
function wOf(profile, key) {
  const qw = profile && profile.qweights
  const w = qw ? qw[key] : undefined
  if (typeof w !== 'number' || !isFinite(w)) return 1
  return Math.max(0.6, Math.min(1.5, w))
}

/** 双方对该维的均权（本次差异/一致的话语权） */
function wMean(a, b, key) {
  return (wOf(a, key) + wOf(b, key)) / 2
}

/**
 * @returns {{total:number, dims:object, dimsMeta:array, pairCode:string,
 *            diffs:array, strengths:array, fingerprint:string}}
 *  diffs[i]     = { kind, key, aVal, bVal, gap }   —— 纯事实，无文案
 *  strengths[i] = { kind, key, aVal, bVal }        —— 同构事实
 */
/**
 * 一处差异 / 一致项落在哪一维，基数多少。
 *
 * 差异与一致走**同一套路由**：答得不一样扣这一维，答得一样就补回同一维。
 *
 * ⚠️ 这里曾经是个真 bug：旧实现把「一致」无差别加到四个维上，
 *    于是两个人只要有几处相同，四个维度会一起被顶到上限（演示关系四项全是 95），
 *    维度就此失去区分度 —— 报告里的四轴读数变成一句废话。
 *    现在一致只加它自己所属的那一维。
 *
 * 路由表（产品骨架，固定不变）：
 *   mbti  ei/tf → 感情 12 ｜ jp → 生活 12 ｜ 另计 成长 4
 *   style express/reply/emotion/conflict/initiative → 沟通 12 ｜ focus → 生活 8
 *   need  recognition/support → 感情 10 ｜ quality/ritual → 生活 10 ｜ 另计 成长 4
 */
function dimRoutes(d) {
  const r = []
  if (d.kind === 'mbti') {
    if (d.key === 'tf' || d.key === 'ei') r.push(['love', 12])
    if (d.key === 'jp') r.push(['live', 12])
    r.push(['grow', 4])
  } else if (d.kind === 'style') {
    if (['express', 'reply', 'emotion', 'conflict', 'initiative'].indexOf(d.key) >= 0) r.push(['communicate', 12])
    if (d.key === 'focus') r.push(['live', 8])
  } else if (d.kind === 'need') {
    if (d.key === 'recognition' || d.key === 'support') r.push(['love', 10])
    if (d.key === 'quality' || d.key === 'ritual') r.push(['live', 10])
    r.push(['grow', 4])
  }
  return r
}

function analyze(a, b) {
  const A = a || {}
  const B = b || {}

  const diffs = []
  const strengths = []

  AXIS_META.forEach((m) => {
    const av = (A.axes || {})[m.key]
    const bv = (B.axes || {})[m.key]
    if (av === undefined || bv === undefined) return
    if (av !== bv) diffs.push({ kind: 'mbti', key: m.key, aVal: av, bVal: bv, gap: 1 })
    else strengths.push({ kind: 'mbti', key: m.key, aVal: av, bVal: bv })
  })

  STYLE_QUESTIONS.forEach((q) => {
    const av = (A.style || {})[q.key]
    const bv = (B.style || {})[q.key]
    if (typeof av !== 'number' || typeof bv !== 'number') return
    const gap = Math.abs(av - bv)
    if (gap >= 2) diffs.push({ kind: 'style', key: q.key, aVal: av, bVal: bv, gap: gap })
    else if (av === bv) strengths.push({ kind: 'style', key: q.key, aVal: av, bVal: bv })
  })

  NEED_GROUPS.forEach((g) => {
    const av = (A.need || {})[g.key]
    const bv = (B.need || {})[g.key]
    if (av === undefined || bv === undefined) return
    if (av !== bv) diffs.push({ kind: 'need', key: g.key, aVal: av, bVal: bv, gap: 1 })
    else strengths.push({ kind: 'need', key: g.key, aVal: av, bVal: bv })
  })

  // ── 四维参考分：一致加分 / 差异扣分的可解释加权 ──
  // 基数表（哪维挂到哪个四维、基数多少）是产品骨架，固定不变；
  // 数值 = 基数 × AI 权重（该维本卷均权，见 docs/dynamic-quiz-rules.md §4.3）
  const related = { love: [], communicate: [], live: [], grow: [] }
  diffs.forEach((d) => {
    const w = wMean(A, B, d.key)
    dimRoutes(d).forEach(([dim, base]) => related[dim].push(-base * w))
  })
  strengths.forEach((s) => {
    const w = wMean(A, B, s.key)
    dimRoutes(s).forEach(([dim, base]) => related[dim].push(base * w))
  })

  const dims = {}
  DIMS_META.forEach((m) => {
    const delta = related[m.key].reduce((x, y) => x + y, 0)
    dims[m.key] = Math.max(30, Math.min(95, Math.round(62 + delta)))
  })

  const total = Math.round(
    dims.love * 0.3 + dims.communicate * 0.3 + dims.live * 0.2 + dims.grow * 0.2
  )

  return {
    total: total,
    dims: dims,
    dimsMeta: DIMS_META,
    pairCode: pairCode(A, B),
    diffs: diffs,
    strengths: strengths,
    // 结构指纹：任何一处事实变化都会变 → AI 解读的缓存键
    fingerprint: structFingerprint(A, B, diffs, total)
  }
}

/** 配对编号：双方 id 排序后哈希出 4 位大写十六进制，可复现 */
function pairCode(a, b) {
  const ids = [a && a.id ? a.id : '', b && b.id ? b.id : ''].sort().join('&')
  let h = 0
  for (let i = 0; i < ids.length; i++) {
    h = (h * 31 + ids.charCodeAt(i)) >>> 0
  }
  return h.toString(16).toUpperCase().padStart(4, '0').slice(-4)
}

/** 报告结构指纹：用于 AI 解读的缓存键（分布没变就不重复调 AI） */
function structFingerprint(a, b, diffs, total) {
  const sig = [
    (a && a.mbti) || '', (b && b.mbti) || '',
    JSON.stringify((a && a.style) || {}), JSON.stringify((b && b.style) || {}),
    JSON.stringify((a && a.need) || {}), JSON.stringify((b && b.need) || {}),
    diffs.map((d) => `${d.kind}.${d.key}:${d.aVal}-${d.bVal}`).join(','),
    total
  ].join('|')
  let h = 5381
  for (let i = 0; i < sig.length; i++) {
    h = ((h << 5) + h + sig.charCodeAt(i)) >>> 0
  }
  return 'r' + h.toString(16)
}

module.exports = {
  RELATION_TYPES,
  relationTypeLabel,
  RELATION_TAGS,
  relationTag,
  DEFAULT_RELATION_TYPE, DIMS_META, analyze, pairCode, structFingerprint }
