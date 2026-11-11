/**
 * quiz —— 动态题库的纯逻辑层：组卷、权重换算、题目校验。
 *
 * 规则见 docs/dynamic-quiz-rules.md。铁律：
 *   AI 管内容与轻重（出题、每题权重 1-5），规则管标尺与公平（换算表、归一化、组卷）。
 * 本文件不碰 wx、不碰云 SDK —— utils 与 cloudfunctions 双份共用（sync-cloud-logic.sh 同步），
 * verify.py 直接跑这里的函数做属性测试。
 */

// ── AI 权重 → 计分倍率（换算表写死，AI 改不了） ──
const WEIGHT_TABLE = { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.25, 5: 1.5 }

// 每维出题数上限（池子不足时按实际池子缩，锚题必在）
const DESIGN = { mbti: 4, style: 2, need: 2 }

// 新题（gray 探索位）占整卷比例目标
const NEW_RATIO = 0.2

/** 单题权重倍率：weight 字段 1-5，缺省/非法一律按 3（1.0 倍） */
function qWeight(q) {
  const w = q && q.weight
  const m = WEIGHT_TABLE[w]
  return typeof m === 'number' ? m : 1.0
}

/**
 * 维内权重平衡：一道题的权重占比不得超过 60%（防止 AI 给的极端权重绑架一个维度）。
 * n=1（冷启动单题维）不削。返回新数组，不改动输入。
 */
function balanceWeights(weights) {
  const ws = weights.map((w) => (typeof w === 'number' && isFinite(w) && w > 0 ? w : 1.0))
  const sum = ws.reduce((a, b) => a + b, 0)
  if (ws.length < 2 || sum <= 0) return ws
  return ws.map((w) => {
    const share = w / sum
    if (share <= 0.6) return w
    // 削到正好 60%：w' = 0.6/(1-0.6) × 其余权重和
    const others = sum - w
    return Math.round(1.5 * others * 1000) / 1000
  })
}

/**
 * 组卷：锚题必入 → 80% 存量位（优先没见过的）→ 20% 新题位（gray 池，每维至多 1 道）。
 *
 * @param {object} modules  { mbti: {ei:[题]}, style: {express:[题]}, need: {quality:[题]} }
 *                          想出哪个模块就传哪个；题对象需含 id/key(/dim)/weight(/anchor/status)
 * @param {object} opts     { recentIds: [该用户近期做过的题 id]，用于重测轮换 }
 * @returns {object}        { mbti:[题], style:[题], need:[题],
 *                           meta: { items:[{id,w}], newCount, total, newRatio } }
 * 确定性：同样输入必出同样的卷（无随机数，verify.py 可断言）。
 */
function buildPaper(modules, opts) {
  const o = opts || {}
  const recent = {}
  ;(o.recentIds || []).forEach((id) => { recent[id] = true })
  const paper = {}
  const items = []
  let newCount = 0
  let total = 0

  Object.keys(modules).forEach((module) => {
    const dims = modules[module] || {}
    const dimKeys = Object.keys(dims)
    const perDim = DESIGN[module] || 4

    // 先算本模块的出题总量与新题名额（每维至多摊 1 道）
    let serveTotal = 0
    dimKeys.forEach((k) => { serveTotal += Math.min(perDim, (dims[k] || []).length) })
    let newSlots = Math.min(Math.round(serveTotal * NEW_RATIO), dimKeys.length)

    const served = []
    dimKeys.forEach((k) => {
      const pool = (dims[k] || []).filter((q) => q && q.id && q.status !== 'retired' && q.status !== 'banned')
      if (!pool.length) return
      const anchor = pool.find((q) => q.anchor) || null
      const rest = anchor ? pool.filter((q) => q !== anchor) : pool.slice()
      // 没见过的排前（保持池内原序），见过的垫后 → 重测自然换题
      const unseen = rest.filter((q) => !recent[q.id])
      const seen = rest.filter((q) => recent[q.id])
      const ordered = unseen.concat(seen)

      const fill = Math.min(perDim, pool.length) - (anchor ? 1 : 0)
      const picks = []

      // 新题位：gray + 没见过，优先消耗名额；gray 断供就回落存量（newRatio 如实变小）
      if (newSlots > 0) {
        const gi = ordered.findIndex((q) => q.status === 'gray' && !recent[q.id])
        if (gi >= 0) {
          picks.push(ordered.splice(gi, 1)[0])
          newSlots--
          newCount++
        }
      }
      while (picks.length < fill && ordered.length) picks.push(ordered.shift())
      if (anchor) picks.unshift(anchor)

      served.push(picks)
      picks.forEach((q) => {
        items.push({ id: q.id, w: qWeight(q) })
        total++
      })
    })
    paper[module] = served.reduce((a, b) => a.concat(b), [])
  })

  return {
    mbti: paper.mbti || [],
    style: paper.style || [],
    need: paper.need || [],
    meta: {
      items: items,
      newCount: newCount,
      total: total,
      newRatio: total ? Math.round((newCount / total) * 1000) / 1000 : 0
    }
  }
}

// ── 题目校验（生成侧三闸之一：结构闸；合规闸在 ai.complianceScan） ──

/** 中文双字 bigram 相似度：新题查重用，≥0.55 视为近似重复 */
function similarText(a, b) {
  const x = String(a || '').replace(/\s/g, '')
  const y = String(b || '').replace(/\s/g, '')
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0
  const grams = {}
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.slice(i, i + 2)
    grams[g] = (grams[g] || 0) + 1
  }
  let hit = 0
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.slice(i, i + 2)
    if (grams[g] > 0) { hit++; grams[g]-- }
  }
  return hit / Math.max(x.length - 1, y.length - 1)
}

/**
 * 校验一道 AI 生成的新题。通过返回清洗后的题对象，不通过返回 null（reason 说明原因）。
 * @param {object} q           { text|note, options, weight, tag? }
 * @param {object} spec        { module, dim, tagFamily: [该组允许的 2 字 tag]（仅 need） }
 */
function validateQuestion(q, spec) {
  if (!q || typeof q !== 'object') return { ok: false, reason: 'empty' }
  const module = spec.module
  const weight = q.weight
  if (!Number.isInteger(weight) || weight < 1 || weight > 5) return { ok: false, reason: 'weight' }

  if (module === 'mbti') {
    const text = String(q.text || '').trim()
    if (text.length < 6 || text.length > 40) return { ok: false, reason: 'text' }
    if (!Array.isArray(q.options) || q.options.length !== 2) return { ok: false, reason: 'options' }
    if (q.options.some((x) => !String(x || '').trim() || String(x).length > 30)) return { ok: false, reason: 'option-text' }
    return { ok: true, question: { module: module, dim: spec.dim, text: text, options: q.options.map((x) => String(x).trim()), weight: weight } }
  }

  if (module === 'style') {
    const note = String(q.note || '').trim()
    if (note.length < 4 || note.length > 30) return { ok: false, reason: 'text' }
    if (!Array.isArray(q.options) || q.options.length !== 4) return { ok: false, reason: 'options' }
    if (q.options.some((x) => !String(x || '').trim() || String(x).length > 24)) return { ok: false, reason: 'option-text' }
    return { ok: true, question: { module: module, dim: spec.dim, note: note, options: q.options.map((x) => String(x).trim()), weight: weight } }
  }

  if (module === 'need') {
    const text = String(q.text || '').trim()
    if (text.length < 6 || text.length > 40) return { ok: false, reason: 'text' }
    if (!Array.isArray(q.options) || q.options.length !== 2) return { ok: false, reason: 'options' }
    const family = spec.tagFamily || []
    for (const o of q.options) {
      const tag = o && String(o.tag || '').trim()
      if (!tag || tag.length !== 2) return { ok: false, reason: 'tag' }
      if (family.length && family.indexOf(tag) < 0) return { ok: false, reason: 'tag-family' }
    }
    return {
      ok: true,
      question: {
        module: module,
        dim: spec.dim,
        text: text,
        options: q.options.map((o) => ({ text: String(o.text || '').trim(), tag: String(o.tag || '').trim() })),
        weight: weight
      }
    }
  }

  if (module === 'statement') {
    const text = String(q.text || '').trim()
    if (text.length < 8 || text.length > 24) return { ok: false, reason: 'text' }
    const tag = String(q.tag || '').trim()
    if (tag.length !== 2) return { ok: false, reason: 'tag' }
    return { ok: true, question: { module: module, dim: '', text: text, tag: tag } }
  }

  return { ok: false, reason: 'module' }
}

/** 新题查重：与同维既有题干/场景做相似度比对，命中即拒 */
function isDuplicate(candidate, existingTexts) {
  const cand = candidate.text || candidate.note || ''
  return (existingTexts || []).some((t) => similarText(cand, t) >= 0.55)
}

/**
 * 题库契约归一化（唯一的拥有边界）。
 *
 * 为什么必须在这里做：云函数与客户端各自发布，题库格式会短暂不同步——
 * 旧版 getQuiz 下发的题没有 id，而 buildPaper 要求 id（没有 id 就无法记账、去重、
 * 轮换），一池题会被静默丢弃，整张卷子变成空白页。
 * 所以：进到系统里的题，一律先补齐契约字段（id / key / weight / status / anchor），
 * 下游（buildPaper / 计分 / 遥测）只信这些字段，不再各自兜底。
 *
 * 幂等：已带 id 的题原样保留 id（不重编号，避免云端升级后题库换 id 造成重测抖动）。
 */
const MODULE_PREFIX = { mbti: 'm', style: 's', need: 'n' }

function normalizeBank(bank) {
  const src = bank && typeof bank === 'object' ? bank : {}
  const out = { mbti: [], style: [], need: [], statements: [] }
  ;['mbti', 'style', 'need'].forEach((module) => {
    const list = Array.isArray(src[module]) ? src[module] : []
    // 整模块只要有一道题标了 anchor，就以云端标记为准；全都没标时按「每维首题」兜底
    // （与种子题库的锚题定义一致：每维第一题是锚题）
    const hasAnchor = list.some((q) => q && q.anchor)
    const perDim = {}
    list.forEach((q) => {
      if (!q || typeof q !== 'object') return
      const key = q.key || q.dim || ''
      const n = (perDim[key] = (perDim[key] || 0) + 1)
      const id = String(q.id || (MODULE_PREFIX[module] + '_' + key + '_' + n))
      const w = q.weight
      out[module].push(Object.assign({}, q, {
        id: id,
        key: key,
        weight: (Number.isInteger(w) && w >= 1 && w <= 5) ? w : 3,
        status: q.status || 'stable',
        anchor: hasAnchor ? !!q.anchor : n === 1
      }))
    })
  })
  const st = Array.isArray(src.statements) ? src.statements : []
  out.statements = st.filter((s) => s && s.id).map((s) => ({ id: s.id, text: s.text, tag: s.tag }))
  return out
}

/**
 * 每个维度同时留在池里的"待判新题"上限：组卷配额 + 1 道缓冲。
 * 为什么要有上限：组卷时每维每份卷子只出 1 道新题（4 × 20%），
 * 多备的全是死库存 —— 出卷轮不到、判不了、还把新题占比撑到 90%。
 * 补题与清理用同一个公式（这里），避免两处各写一份比例。
 */
function grayQuota(servedPerDim) {
  return Math.max(1, Math.ceil((servedPerDim || 4) * NEW_RATIO)) + 1
}

module.exports = {
  WEIGHT_TABLE,
  DESIGN,
  NEW_RATIO,
  grayQuota,
  qWeight,
  balanceWeights,
  buildPaper,
  similarText,
  validateQuestion,
  isDuplicate,
  normalizeBank
}
