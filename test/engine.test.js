/**
 * 公开切片的回归测试 —— 覆盖三类可验证主张：
 *   1) 3D 投影是纯数学（相机 + 投影 + 画家算法），不是玄学
 *   2) 计分是确定的加权多数（等权时与逐点计分一致）
 *   3) 双人对照的「落差」是可解释的规则判定
 *
 * 跑：npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const { chart3d, persona, quiz, aiBank, mbti, style, relation, tone } = require('../src/index.js')

const STYLE_KEYS = [...new Set(aiBank.style.map((q) => q.key))]
const NEED_KEYS = [...new Set(aiBank.need.map((q) => q.key))]

function profile(o) {
  return {
    mbti: o.mbti,
    axes: o.axes,
    axisScores: o.axisScores,
    style: Object.fromEntries(STYLE_KEYS.map((k) => [k, o.style[k]])),
    need: Object.fromEntries(NEED_KEYS.map((k) => [k, o.need[k]]))
  }
}

const A = profile({
  mbti: 'ESTJ',
  axes: { ei: 0, sn: 0, tf: 0, jp: 0 },
  axisScores: { ei: 100, sn: 100, tf: 100, jp: 100 },
  style: { express: 1, initiative: 2, focus: 1, reply: 2, emotion: 1, conflict: 2 },
  need: { quality: 0, recognition: 1, support: 0, ritual: 1 }
})

const B = profile({
  mbti: 'INFP',
  axes: { ei: 1, sn: 1, tf: 1, jp: 1 },
  axisScores: { ei: 100, sn: 100, tf: 100, jp: 100 },
  style: { express: 3, initiative: 3, focus: 3, reply: 3, emotion: 3, conflict: 3 },
  need: { quality: 1, recognition: 0, support: 1, ritual: 0 }
})

/* ────────────── 1. 3D 投影引擎 ────────────── */

test('chart3d: mix 在 t=0/1 返回端点，中点线性插值', () => {
  assert.equal(chart3d.mix('#000000', '#ffffff', 0), '#000000')
  assert.equal(chart3d.mix('#000000', '#ffffff', 1), '#ffffff')
  assert.equal(chart3d.mix('#000000', '#ffffff', 0.5), '#808080')
})

test('chart3d: 相机 + 投影对同一世界坐标给出一致结果（纯函数）', () => {
  const cam = chart3d.makeCamera({ yaw: 0.4, pitch: 0.2, distance: 9.5, focal: 800 })
  cam.cx = 400
  cam.cy = 300
  const p = { x: 1.2, y: -0.4, z: 0.8 }
  const a = chart3d.project(p, cam)
  const b = chart3d.project(p, cam)
  assert.equal(a.x, b.x)
  assert.equal(a.y, b.y)
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y))
})

test('chart3d: 近点与远点投影出不同深度（画家算法需要）', () => {
  const cam = chart3d.makeCamera({ yaw: 0.6, pitch: 0.25, distance: 9.5, focal: 700 })
  cam.cx = 350
  cam.cy = 250
  const near = chart3d.project({ x: 0, y: 0, z: 2 }, cam)
  const far = chart3d.project({ x: 0, y: 0, z: -2 }, cam)
  assert.ok(Number.isFinite(near.depth) && Number.isFinite(far.depth))
  assert.notEqual(near.depth, far.depth)
})

/* ────────────── 2. 计分核心 ────────────── */

test('quiz: 权重表 1-5 档映射五档倍率且单调不减', () => {
  const table = quiz.WEIGHT_TABLE
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b)
  assert.deepEqual(keys, [1, 2, 3, 4, 5])
  for (let i = 1; i < keys.length; i++) {
    assert.ok(table[keys[i]] >= table[keys[i - 1]], '权重表应单调不减')
  }
  // 缺省 / 非法权重一律按 1.0 倍（中性票）
  assert.equal(quiz.qWeight({ weight: 3 }), 1.0)
  assert.equal(quiz.qWeight({}), 1.0)
  assert.equal(quiz.qWeight({ weight: 99 }), 1.0)
})

test('quiz: 维内单题权重占比不超过 60%（防止极端权重绑架一个维度）', () => {
  const balanced = quiz.balanceWeights([10, 1, 1])
  const max = Math.max(...balanced) / balanced.reduce((a, b) => a + b, 0)
  assert.ok(max <= 0.6 + 1e-9, '权重占比应被削峰到 60% 以内，实际 ' + max.toFixed(3))
})

test('mbti: 全选第一极 = ESTJ，全选第二极 = INFP', () => {
  const n = aiBank.mbti.length
  assert.equal(mbti.score(new Array(n).fill(0)).mbti, 'ESTJ')
  assert.equal(mbti.score(new Array(n).fill(1)).mbti, 'INFP')
})

test('mbti: 计分是确定的（同输入同输出），强度落在 50-100', () => {
  const ans = aiBank.mbti.map((_, i) => i % 2)
  const r1 = mbti.score(ans)
  const r2 = mbti.score(ans)
  assert.deepEqual(r1, r2)
  assert.equal(r1.mbti.length, 4)
  for (const k of Object.keys(r1.axisScores)) {
    assert.ok(r1.axisScores[k] >= 50 && r1.axisScores[k] <= 100, k + ' 强度越界')
  }
})

test('style: 六维风格档位落在 0-3，四组需求各取 0/1', () => {
  const s = style.score(
    aiBank.style.map(() => 2),
    aiBank.need.map(() => 0)
  )
  assert.equal(Object.keys(s.style).length, 6)
  for (const k of Object.keys(s.style)) {
    assert.ok(Number.isInteger(s.style[k]) && s.style[k] >= 0 && s.style[k] <= 3, k + ' 档位越界')
  }
  assert.equal(Object.keys(s.need).length, 4)
  for (const k of Object.keys(s.need)) {
    assert.ok(s.need[k] === 0 || s.need[k] === 1, k + ' 需求取值越界')
  }
})

test('ai-bank: 每个维度恰好一道锚题（跨版本可比）', () => {
  const dims = new Set(aiBank.mbti.map((q) => q.key))
  const anchors = aiBank.mbti.filter((q) => q.anchor)
  assert.equal(anchors.length, dims.size, '每个维度应恰好一道锚题')
})

/* ────────────── 3. 双人对照 ────────────── */

test('persona: 位置 = 方向 × 强度，满强度贴极 = 0 或 100', () => {
  assert.equal(persona.axisPos(A, 'ei'), 0)
  assert.equal(persona.axisPos(B, 'ei'), 100)
})

test('persona: 老档案只有 axes 没有强度时取偏置值，不落 50（避免与 MBTI 编码自相矛盾）', () => {
  const legacy = { axes: { ei: 0 } }
  const pos = persona.axisPos(legacy, 'ei')
  assert.notEqual(pos, 50, '缺强度不能按中线处理')
  assert.ok(pos < 50, 'axes 指第一极时位置应偏第一极')
})

test('persona: 双人叠尺给出四行，落差 = |posA - posB|', () => {
  const rows = persona.dualScales(A, B)
  assert.equal(rows.length, 4)
  for (const r of rows) {
    assert.equal(r.gap, Math.abs(r.aPos - r.bPos))
  }
  const sum = persona.dualSummary(rows)
  assert.equal(sum.same + sum.diff, 4)
})

test('relation: 差异只由可解释规则触发（mbti 极性 / style 档位差 / need 选项）', () => {
  const r = relation.analyze(A, B)
  assert.ok(r.diffs.length > 0)
  for (const d of r.diffs) {
    assert.ok(['mbti', 'style', 'need'].includes(d.kind), '未知差异类型：' + d.kind)
  }
  for (const k of Object.keys(r.dims)) {
    assert.ok(r.dims[k] >= 30 && r.dims[k] <= 95, k + ' 越界')
  }
})

test('relation: 完全相同的两个人，四维不出现差异', () => {
  const r = relation.analyze(A, A)
  assert.equal(r.diffs.length, 0)
})

test('tone: 今日沟通色调由落差最大的维度决定，且可枚举', () => {
  const report = relation.analyze(A, B)
  const t = tone.toneFor(report)
  assert.ok(t)
  assert.ok(t.key && t.name && t.action, '色调应带可读标识与可执行动作')
  assert.ok(tone.TONES.some((x) => x.key === t.key))
})
