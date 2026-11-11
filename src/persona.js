/**
 * 人格侧写：把两个人的档案放到**同一条有刻度的轴**上。
 *
 * 这是本产品的签名表达。
 * 竞品把人格写成文字标签（测测）或一个大字 + 动物原型，
 * 没有人把「两个人在同一把尺上的位置」画出来。
 * 我们的做法是：每个人在四条轴上各有一个位置，
 * 两个位置之间的距离，就是这段关系里这一维的真实落差。
 *
 * 数据来源：
 *   axes       每维偏向哪个字母（0 = 第一极，1 = 第二极）
 *   axisScores 每维的强度 50-100（50 = 平手，100 = 极端）
 * 两者合起来才是一个双极坐标上的位置，只看 axes 会丢失强度信息。
 */

const AXIS_META = [
  { key: 'ei', code: 'EI', label: '精力方向', low: '向外充电', high: '向内充电' },
  { key: 'sn', code: 'SN', label: '信息偏好', low: '关注实感', high: '关注可能' },
  { key: 'tf', code: 'TF', label: '决策依据', low: '用逻辑决策', high: '用感受决策' },
  { key: 'jp', code: 'JP', label: '生活秩序', low: '偏好计划', high: '偏好灵活' }
]

/** 两个人的位置差小于这个值就算「基本在同一侧」 */
const SAME_THRESHOLD = 12

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * 某一维在双极轴上的位置，0 = 贴着第一极，100 = 贴着第二极
 */
function axisPos(profile, key) {
  const p = profile || {}
  const axes = p.axes || {}
  const scores = p.axisScores || {}
  // 强度是「离中线多远」，方向由 axes 决定，两者合起来才是位置。
  // ⚠️ 老档案只有 axes 没有 axisScores 时，强度缺省**不能用 50**：
  //    50 会被 pos>=50 判成第二极，导致「MBTI 写 ESTJ、胶囊却显示 I」同屏自相矛盾。
  //    缺省取 70（明确偏向 axes 指定的那一极）。
  const intensity = typeof scores[key] === 'number' ? scores[key] : 70
  const towardSecond = axes[key] === 1
  const pos = towardSecond ? intensity : 100 - intensity
  return Math.round(clamp(pos, 0, 100))
}

/**
 * 单人侧写：四条尺，每个人的点
 */
function scales(profile) {
  return AXIS_META.map((m) => {
    const pos = axisPos(profile, m.key)
    return {
      key: m.key,
      code: m.code,
      label: m.label,
      low: m.low,
      high: m.high,
      pos: pos,
      // 读数：像仪表上的位置，不重复极点名（极点名在轴两端）
      read: pos + ' / 100',
      // 这个人更靠近哪一极
      side: pos >= 50 ? m.high : m.low,
      // 极性单字母（E/I、S/N、T/F、J/P）——读数胶囊用这个：短、准、贴档案编码语言
      sideCode: (pos >= 50 ? m.code[1] : m.code[0])
    }
  })
}

/**
 * 双人叠尺：同一条轴上两个点 + 两点之间的距离
 * @param {object} a 我的档案
 * @param {object} b 对方档案
 */
function dualScales(a, b) {
  const sa = scales(a)
  const sb = scales(b)

  return sa.map((s, i) => {
    const t = sb[i]
    const gap = Math.abs(s.pos - t.pos)
    const left = Math.min(s.pos, t.pos)
    return {
      key: s.key,
      code: s.code,
      label: s.label,
      low: s.low,
      high: s.high,
      aPos: s.pos,
      bPos: t.pos,
      // 高亮跨距的起止与宽度
      spanLeft: left,
      spanWidth: Math.max(gap, 2),
      gap: gap,
      aWord: s.side,
      bWord: t.side,
      same: gap <= SAME_THRESHOLD
    }
  })
}

/** 两条轴上共有几处一致、几处有落差 */
function dualSummary(rows) {
  const same = rows.filter((r) => r.same).length
  return {
    same: same,
    diff: rows.length - same,
    avgGap: rows.length
      ? Math.round(rows.reduce((sum, r) => sum + r.gap, 0) / rows.length)
      : 0
  }
}

/** 档案里已经填好的项（分组计数，和 app.profileProgress 一致） */
function filledCount(profile) {
  const p = profile || {}
  const items = [
    !!(p.mbti && p.axes),
    !!(p.style && Object.keys(p.style).length >= 6),
    !!(p.need && Object.keys(p.need).length >= 4),
    !!p.relationState,
    !!(p.nickname && p.nickname.trim())
  ]
  return items.filter(Boolean).length
}

/**
 * 索引码：真的编码了档案内容，不是装饰编号。
 * 形如  A INTJ 4/5 1025
 *      A  = 档案类别（A 个人档案 / R 配对报告）
 *      INTJ = 性格类型
 *      4/5 = 已填项 / 总项
 *      1025 = 建档日（月日）
 */
function indexCode(profile, kind) {
  const p = profile || {}
  const type = p.mbti || '····'
  const filled = filledCount(p)
  const total = 5
  const stamp = p.updatedAt ? new Date(p.updatedAt) : new Date()
  const mm = String(stamp.getMonth() + 1).padStart(2, '0')
  const dd = String(stamp.getDate()).padStart(2, '0')
  const prefix = kind === 'R' ? 'R' : 'A'
  return prefix + ' ' + type + ' ' + filled + '/' + total + ' ' + mm + dd
}

/**
 * 配对报告的索引码：双方类型 + 配对编号
 * 形如  R INTJ×ENFP BFA8
 */
function pairIndexCode(a, b, pairCode) {
  const ta = (a && a.mbti) || '····'
  const tb = (b && b.mbti) || '····'
  return 'R ' + ta + '×' + tb + ' ' + (pairCode || '····')
}

/** MBTI 四个字母的中文名 */
const LETTER_NAME = {
  E: '外向', I: '内向',
  S: '实感', N: '直觉',
  T: '思考', F: '情感',
  J: '判断', P: '感知'
}

/**
 * 类型行：INTJ → "外向 · 直觉 · 思考 · 判断"
 * 比「向外充电 · 关注可能 · 用逻辑决策 · 偏好计划」短得多，
 * 档案卡上用这一行就够，细节留给下面的尺。
 */
function typeLine(profile) {
  const t = (profile && profile.mbti) || ''
  if (!t) return ''
  return t.split('').map((c) => LETTER_NAME[c] || c).join(' · ')
}

module.exports = {
  AXIS_META,
  SAME_THRESHOLD,
  LETTER_NAME,
  axisPos,
  scales,
  dualScales,
  dualSummary,
  filledCount,
  indexCode,
  pairIndexCode,
  typeLine
}
