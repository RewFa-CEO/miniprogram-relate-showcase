/**
 * 今日沟通色调 —— 把读数变成一个能做的动作。
 *
 * 背景（竞品案例 CASE-16）：
 *   竞品把抽象名词拆成可点击的部件，用户操作的是**动作**而不是概念。
 *   我们借的是外壳：① 名词 → 可点击的交互部件 ③ 色彩即产品语言。
 *   ⛔ 不借牌面含义与推理链；不收集出生信息；不做断言式结论。
 *
 * 这里给的是**沟通色调**：三类对照（双人四轴 / 沟通节奏 / 关系需求）里
 * 落差最大的那一维，决定「今天先做什么」的色彩与一句话动作。
 *
 * 为什么在本机算：
 *   色调完全由 report.diffs（双方档案的结构差）推出，
 *   不需要 AI、不需要服务端 —— 页面拿到结构就能算。
 *
 * 三条红线：
 *   1. **不按日期或随机取值** —— 同一份读数永远是同一个色调。
 *      一旦变成「今天随机给个色」，它就成了另一种东西。
 *   2. **输出是偏好与依据，不是断言** —— 文案里不许出现「一定 / 必然 / 注定」。
 *   3. **颜色只取档案室色板那四个**（纸底 / 墨 / 朱红 / 松石），
 *      色值由 app.wxss 的 CSS 变量提供，业务代码里不散落裸色值。
 *   4. **不露内部刻度**：沟通节奏的 0-3 档位是内部刻度，用户看不懂也不关心，
 *      只以「落差最大 / 不是同一处」这类相对说法出现（见 basisFor）。
 *      公开可说的刻度只有两处：四轴板的「差 N」与各段的「N 处」。
 *
 * 维度名的 owner 不在这里：风格维的标题归 utils/style.js，
 * 性格轴的标签归 utils/persona.js —— 这里只取用，不另存一份。
 */

const style = require('./style')
const persona = require('./persona')

/** 四个色调。token 指 app.wxss 的 CSS 变量名，色值不写在这儿。 */
const TONES = [
  {
    key: 'ink',
    name: '墨',
    token: '--ink',
    cls: 'tone-ink',
    headline: '收着说',
    action: '今天先问一句，让 TA 把话说完，别急着给方案。'
  },
  {
    key: 'self',
    name: '朱红',
    token: '--self',
    cls: 'tone-self',
    headline: '先说你这边',
    action: '今天先把你这边怎么想的说一遍，别替 TA 猜。'
  },
  {
    key: 'other',
    name: '松石',
    token: '--other',
    cls: 'tone-other',
    headline: '先接住',
    action: '今天先把 TA 要的那一项给到，先别解释你为什么给。'
  },
  {
    key: 'paper',
    name: '纸',
    token: '--paper',
    cls: 'tone-paper',
    headline: '不用改',
    action: '现在的节奏就挺好，今天不用特意调什么。'
  }
]

function toneOf(key) {
  const t = TONES.filter((x) => x.key === key)[0]
  return t || TONES[TONES.length - 1]
}

// ── 维度名：向 owner 取，不在这里另存一份 ──
function styleTitle(key) {
  const q = style.STYLE_QUESTIONS.filter((x) => x.key === key)[0]
  return q ? (q.title || '') : ''
}

function needLabel(key) {
  const g = style.NEED_GROUPS.filter((x) => x.key === key)[0]
  return g ? (g.label || '') : ''
}

function axisLabel(key) {
  const m = persona.AXIS_META.filter((x) => x.key === key)[0]
  return m ? (m.label || '') : ''
}

/**
 * 同一类里落差最大的那一条。
 * 表达节奏的 gap 是档差（2 或 3），其余两类恒为 1（只是不在同侧）。
 */
function worst(diffs, kind) {
  let best = null
  diffs.forEach((d) => {
    if (!d || d.kind !== kind) return
    if (!best || (d.gap || 0) > (best.gap || 0)) best = d
  })
  return best
}

/** 某一类有几处落差 */
function countOf(diffs, kind) {
  let n = 0
  diffs.forEach((d) => { if (d && d.kind === kind) n++ })
  return n
}

/**
 * 依据：说清是哪一维、为什么是它 —— 只给依据，不给判决。
 *
 * ⛔ 不出现内部刻度：沟通节奏是 0-3 整档（内部刻度），页面上的公开说法是
 * 「落差最大」；「性格轴」「四组对照」这类内部叫法也不进文案 ——
 * 用户在页面上看到的叫法是「双人四轴」「沟通节奏」「关系需求」。
 */
function basisFor(diffs) {
  const s = worst(diffs, 'style')
  if (s) {
    const name = styleTitle(s.key)
    return '你们在「' + (name || '沟通节奏') + '」上落差最大，是最需要先调的一处。'
  }
  const n = worst(diffs, 'need')
  if (n) {
    const name = needLabel(n.key)
    return '你们在「' + (name || '关系需求') + '」上要的完全不一样。'
  }
  const m = worst(diffs, 'mbti')
  if (m) {
    const name = axisLabel(m.key)
    const c = countOf(diffs, 'mbti')
    return '四轴里有 ' + c + ' 处不是同一处' + (name ? '，最明显的是「' + name + '」。' : '。')
  }
  return '没有差得开的地方，你们基本在同一处。'
}

/**
 * 读数 → 沟通色调。
 *
 * 判据（为什么是这个顺序）：
 *   ① 沟通节奏的落差 —— 直接就是「怎么说话」，与色调最贴，排第一。
 *   ② 关系需求的落差 —— 要给的东西不一样，先对齐「给什么」。
 *   ③ 只有四轴不同 —— 底层处理方式不同，先说清自己这边的做法。
 *   ④ 没有落差 —— 不用改，保持现在的节奏。
 *
 * @param {object} report  relation.analyze() 的结果（只用 diffs）
 * @returns {object|null} { key, name, token, cls, headline, action, basis }
 */
function toneFor(report) {
  const diffs = (report && Array.isArray(report.diffs)) ? report.diffs.filter(Boolean) : []
  const t = diffs.length
    ? (worst(diffs, 'style') ? 'ink'
      : (worst(diffs, 'need') ? 'other'
        : (worst(diffs, 'mbti') ? 'self' : 'paper')))
    : 'paper'
  const tone = toneOf(t)
  return {
    key: tone.key,
    name: tone.name,
    token: tone.token,
    cls: tone.cls,
    headline: tone.headline,
    action: tone.action,
    basis: basisFor(diffs)
  }
}

module.exports = { TONES, toneFor }
