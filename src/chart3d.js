/**
 * chart3d —— 小程序 Canvas 2D 上的手写 3D 投影引擎。
 *
 * 为什么不用 WebGL / three.js：
 *  小程序包体与稳定性优先（本项目无 npm 依赖），
 *  数据可视化只需要「旋转 + 平涂 + 深度排序」，
 *  画家算法在几十个面以内完全够用。
 *
 * 视觉语言延续「档案室的尺」：立体但平涂，
 * 面与面只用深浅区分，不用渐变、不用投影。
 *
 * 两个渲染器：
 *  ruler3d   双人叠尺的立体版（四条轨 + 两个测针 + 跨距块）
 *  swarm3d   人群回声的群体粒子（boids-lite 聚类，群体智能的视觉表达）
 */

// ── 颜色 ──────────────────────────────────────────────
const C = {
  paper: '#EFEAE2',
  tint: '#E3DCD0',
  edge: '#DCD5C7',
  rule: '#C9C1B0',
  ink: '#1B1A18',
  ink2: '#6A675F',
  ink3: '#9B968C',
  self: '#C4352A',
  other: '#14756A',
  selfSoft: '#FAEAE6',
  otherSoft: '#E4F0EC'
}

/** 两个 hex 之间插值，t=0 返回 a，t=1 返回 b */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t)
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t)
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t)
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)
}

// ── 相机与投影 ────────────────────────────────────────
/**
 * 世界坐标：x 向右，y 向上，z 朝观察者。
 * 相机绕 y 轴转 yaw，再绕 x 轴转 pitch，站在 z 轴正方向 distance 处。
 */
function makeCamera(opts) {
  return {
    yaw: (opts && opts.yaw) || -0.5,
    pitch: (opts && opts.pitch) || 0.42,
    distance: (opts && opts.distance) || 7,
    focal: (opts && opts.focal) || 620,
    cx: 0,
    cy: 0
  }
}

function project(p, cam) {
  const cy = Math.cos(cam.yaw)
  const sy = Math.sin(cam.yaw)
  const cp = Math.cos(cam.pitch)
  const sp = Math.sin(cam.pitch)
  // yaw（绕 y 轴）
  const x1 = p.x * cy + p.z * sy
  const z1 = -p.x * sy + p.z * cy
  // pitch（绕 x 轴）
  const y2 = p.y * cp - z1 * sp
  const z2 = p.y * sp + z1 * cp
  const depth = z2 + cam.distance
  const scale = cam.focal / Math.max(depth, 0.1)
  return {
    x: cam.cx + x1 * scale,
    y: cam.cy - y2 * scale,
    depth: depth,
    scale: scale
  }
}

// ── 面片与画家算法 ────────────────────────────────────
/** 一个长方体 8 个角点、6 个面。faces 的第四位是受光系数（平涂深浅）。 */
function boxFaces(x0, y0, z0, x1, y1, z1) {
  const c = [
    { x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 },
    { x: x0, y: y0, z: z1 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }
  ]
  return [
    { idx: [3, 2, 6, 7], light: 1.0 },   // 顶
    { idx: [0, 1, 5, 4], light: 0.45 },  // 底
    { idx: [1, 2, 6, 5], light: 0.8 },   // +x 侧
    { idx: [0, 3, 7, 4], light: 0.62 },  // -x 侧
    { idx: [4, 5, 6, 7], light: 0.9 },   // 前面(z+)
    { idx: [0, 1, 2, 3], light: 0.55 }   // 后面
  ].map((f) => ({ pts: f.idx.map((i) => c[i]), light: f.light }))
}

/** 把所有面按平均深度从远到近排序后平涂描边画出 */
function paintFaces(ctx, cam, faces, color, edgeColor, alpha) {
  const drawn = faces.map((f) => {
    const proj = f.pts.map((p) => project(p, cam))
    const d = proj.reduce((s, q) => s + q.depth, 0) / proj.length
    return { proj, d, light: f.light }
  })
  drawn.sort((a, b) => b.d - a.d)
  if (alpha !== undefined) ctx.globalAlpha = alpha
  drawn.forEach((f) => {
    ctx.beginPath()
    f.proj.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
    ctx.closePath()
    // 平涂深浅：向墨色偏移，模拟顶光，不用渐变
    ctx.fillStyle = mix(color, C.ink, (1 - f.light) * 0.22)
    ctx.fill()
    if (edgeColor) {
      ctx.strokeStyle = edgeColor
      ctx.lineWidth = 1
      ctx.stroke()
    }
  })
  if (alpha !== undefined) ctx.globalAlpha = 1
}

// ── 渲染器一：双人叠尺 3D ─────────────────────────────
/**
 * 四条轴轨在深度方向平行排开（像桌上并排的四把尺），
 * 每条轨上：红针 = 你，绿针 = TA，针高 = 位置读数，
 * 中间的半透明块 = 两个人的跨距（落差越大块越长）。
 *
 * @param {Array} dual  persona.dualScales 的返回值
 * @param {object} opts { yaw, pitch, w, h, showLabels }
 */
function drawRuler3d(ctx, dual, opts) {
  const w = opts.w
  const h = opts.h
  const cam = makeCamera({ yaw: opts.yaw, pitch: opts.pitch, distance: 9.5, focal: Math.min(w, h) * 1.55 })
  cam.cx = w / 2
  cam.cy = h / 2 + h * 0.08

  ctx.clearRect(0, 0, w, h)

  const n = dual.length
  const railW = 6.4                     // 轨长（世界单位）
  const railGap = 1.55                  // 轨间距（深度方向）
  const z0 = -(n - 1) * railGap * 0.5

  // ── 蓝图地面：x 方向刻度线（0/25/50/75/100）+ z 方向轨端纵线 ──
  ctx.lineWidth = 1
  for (let t = 0; t <= 10; t++) {
    const x = -railW / 2 + (t / 10) * railW
    const major = t % 5 === 0
    const a = project({ x, y: -0.55, z: z0 - 0.55 }, cam)
    const b = project({ x, y: -0.55, z: z0 + (n - 1) * railGap + 0.55 }, cam)
    ctx.strokeStyle = major ? C.rule : C.edge
    ctx.globalAlpha = major ? 0.9 : 0.55
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    if (major && opts.showLabels !== false) {
      // 0 / 50 / 100 读数压在网格下方，蓝图标注感
      const q = project({ x, y: -0.55, z: z0 + (n - 1) * railGap + 0.75 }, cam)
      ctx.globalAlpha = 0.75
      ctx.fillStyle = C.ink3
      ctx.font = '10px Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(t * 10), q.x, q.y)
    }
    ctx.globalAlpha = 1
  }
  for (let i = 0; i <= n; i++) {
    const z = z0 - 0.55 + i * railGap
    const a = project({ x: -railW / 2, y: -0.55, z }, cam)
    const b = project({ x: railW / 2, y: -0.55, z }, cam)
    ctx.strokeStyle = C.edge
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  dual.forEach((d, i) => {
    const z = z0 + i * railGap
    const zw = 0.34
    // 轨体（刻度底色的扁盒）
    paintFaces(ctx, cam, boxFaces(-railW / 2, -0.5, z - zw / 2, railW / 2, -0.34, z + zw / 2), C.tint, C.edge)
    // 轨端头块：两端的深色收口，量具的端挡
    paintFaces(ctx, cam, boxFaces(-railW / 2 - 0.12, -0.52, z - zw / 2, -railW / 2, -0.3, z + zw / 2), mix(C.ink, C.paper, 0.55), null)
    paintFaces(ctx, cam, boxFaces(railW / 2, -0.52, z - zw / 2, railW / 2 + 0.12, -0.3, z + zw / 2), mix(C.ink, C.paper, 0.55), null)

    const toX = (pos) => -railW / 2 + (pos / 100) * railW
    const hgt = (pos) => 0.5 + (pos / 100) * 2.3
    const pinW = 0.16

    // 跨距块：两点之间的半透明连接（落差越大越长）
    const xa = toX(Math.min(d.aPos, d.bPos))
    const xb = toX(Math.max(d.aPos, d.bPos))
    paintFaces(ctx, cam, boxFaces(xa, -0.34, z - 0.05, xb, -0.05, z + 0.05), mix(C.ink, C.paper, 0.82), C.rule, 0.5)

    // 两根测针：高度即读数，位置即轴上位置
    paintFaces(ctx, cam, boxFaces(toX(d.aPos) - pinW / 2, -0.34, z - pinW, toX(d.aPos) + pinW / 2, hgt(d.aPos), z + pinW), C.self, mix(C.self, C.ink, 0.45))
    paintFaces(ctx, cam, boxFaces(toX(d.bPos) - pinW / 2, -0.34, z - pinW, toX(d.bPos) + pinW / 2, hgt(d.bPos), z + pinW), C.other, mix(C.other, C.ink, 0.45))

    // ── 读数铭牌：针顶的白底墨字小圆角矩形，仪表铭牌感 ──
    if (opts.showLabels !== false) {
      const plate = (pos, color) => {
        const q = project({ x: toX(pos), y: hgt(pos) + 0.16, z }, cam)
        const text = String(pos)
        const size = Math.max(9, Math.min(12, 3 * q.scale / cam.focal * 500))
        ctx.font = `${size}px Menlo, monospace`
        const tw = ctx.measureText(text).width + 10
        const th = size + 8
        // 白底描边圆角矩形
        ctx.beginPath()
        const r = 3
        ctx.moveTo(q.x - tw / 2 + r, q.y - th)
        ctx.arcTo(q.x + tw / 2, q.y - th, q.x + tw / 2, q.y, r)
        ctx.arcTo(q.x + tw / 2, q.y, q.x - tw / 2, q.y, r)
        ctx.arcTo(q.x - tw / 2, q.y, q.x - tw / 2, q.y - th, r)
        ctx.closePath()
        ctx.fillStyle = C.card
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.fillText(text, q.x, q.y - 4)
      }
      plate(d.aPos, C.self)
      plate(d.bPos, C.other)

      // 轴名铭牌：左侧的 EI/SN/TF/JP
      const q = project({ x: -railW / 2 - 0.5, y: 0.12, z }, cam)
      ctx.fillStyle = C.ink3
      ctx.font = '11px Menlo, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(d.code, q.x, q.y)
    }
  })
}

// ── 渲染器一b：双山脊丝带 ─────────────────────────────
/**
 * 两条平滑缎带横跨四个轴站（红=你，绿=TA），高度即读数。
 * 每站画落差标尺（虚线 + 差值气泡）。缎带有 z 向厚度，
 * 顶面主色平涂、侧沿深色，随拖转流动。
 *
 * @param {Array} dual persona.dualScales 的返回值
 */
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function drawRidge3d(ctx, dual, opts) {
  const w = opts.w
  const h = opts.h
  const cam = makeCamera({ yaw: opts.yaw, pitch: opts.pitch, distance: 8.8, focal: Math.min(w, h) * 1.5 })
  cam.cx = w / 2
  cam.cy = h / 2 + h * 0.1

  ctx.clearRect(0, 0, w, h)

  const n = dual.length
  const span = 6.2
  const z0 = -(n - 1) * 0
  const stations = dual.map((d, i) => ({
    x: -span / 2 + (i / (n - 1)) * span,
    a: d.aPos,
    b: d.bPos,
    code: d.code,
    d: d
  }))
  const hgt = (pos) => 0.25 + (pos / 100) * 2.35
  const RW = 0.36   // 缎带半厚

  // ── 蓝图地面网格 ──
  ctx.lineWidth = 1
  for (let t = 0; t <= 10; t++) {
    const x = -span / 2 - 0.35 + (t / 10) * (span + 0.7)
    const major = t % 5 === 0
    const a = project({ x, y: -0.3, z: -1.15 }, cam)
    const b = project({ x, y: -0.3, z: 1.15 }, cam)
    ctx.strokeStyle = major ? C.rule : C.edge
    ctx.globalAlpha = major ? 0.85 : 0.5
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    if (major) {
      const q = project({ x, y: -0.3, z: 1.4 }, cam)
      ctx.globalAlpha = 0.7
      ctx.fillStyle = C.ink3
      ctx.font = '10px Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(t * 10), q.x, q.y)
    }
    ctx.globalAlpha = 1
  }

  // ── 站点参考线 + 轴名铭牌 ──
  stations.forEach((s) => {
    const a = project({ x: s.x, y: -0.3, z: 0 }, cam)
    const b = project({ x: s.x, y: 2.9, z: 0 }, cam)
    ctx.strokeStyle = C.edge
    ctx.globalAlpha = 0.55
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.globalAlpha = 1
    // 底部轴名
    const q = project({ x: s.x, y: -0.55, z: 0 }, cam)
    ctx.fillStyle = C.ink3
    ctx.font = '11px Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(s.code, q.x, q.y + 4)
  })

  // ── 缎带：投影后粗描边（宽圆头线条，半透明，交叉处可读）──
  const ribbon = (posKey, color, zoff) => {
    const pts = stations.map((s) => ({ x: s.x, y: hgt(s[posKey]) }))
    const ext = [Object.assign({}, pts[0], { x: pts[0].x - 0.8 }), ...pts, Object.assign({}, pts[n - 1], { x: pts[n - 1].x + 0.8 })]
    const dense = []
    for (let i = 0; i < ext.length - 3; i++) {
      for (let k = 0; k <= 10; k++) {
        const t = k / 10
        dense.push({
          x: catmull(ext[i].x, ext[i + 1].x, ext[i + 2].x, ext[i + 3].x, t),
          y: catmull(ext[i].y, ext[i + 1].y, ext[i + 2].y, ext[i + 3].y, t)
        })
      }
    }
    const trace = () => {
      ctx.beginPath()
      dense.forEach((pt, i2) => {
        const q = project({ x: pt.x, y: pt.y, z: zoff }, cam)
        i2 ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)
      })
    }
    // 带体：宽圆头粗线，半透明
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    trace()
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.82
    ctx.lineWidth = Math.max(14, w * 0.055)
    ctx.stroke()
    // 脊线：同色深线，缎带的"棱"
    trace()
    ctx.strokeStyle = mix(color, C.ink, 0.45)
    ctx.globalAlpha = 1
    ctx.lineWidth = 2
    ctx.stroke()
    // 端点铭牌：起点读数
    const last = dense[dense.length - 1]
    const q = project({ x: last.x, y: last.y, z: zoff }, cam)
    ctx.font = '11px Menlo, monospace'
    const val = String(posKey === 'a' ? stations[n - 1].a : stations[n - 1].b)
    const tw = ctx.measureText(val).width + 10
    ctx.beginPath()
    const r2 = 3
    const bx = q.x + 10
    const by = q.y - 8
    ctx.moveTo(bx - tw / 2 + r2, by)
    ctx.arcTo(bx + tw / 2, by, bx + tw / 2, by + 16, r2)
    ctx.arcTo(bx + tw / 2, by + 16, bx - tw / 2, by + 16, r2)
    ctx.arcTo(bx - tw / 2, by + 16, bx - tw / 2, by, r2)
    ctx.arcTo(bx - tw / 2, by, bx + tw / 2, by, r2)
    ctx.closePath()
    ctx.fillStyle = C.card
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.fillText(val, bx, by + 12)
  }

  ribbon('a', C.self, 0.55)
  ribbon('b', C.other, -0.55)

  // ── 站点落差标尺：两点垂直虚线 + 差值气泡 ──
  if (opts.showLabels !== false) {
    stations.forEach((s) => {
      const pA = project({ x: s.x, y: hgt(s.a), z: 0.55 }, cam)
      const pB = project({ x: s.x, y: hgt(s.b), z: -0.55 }, cam)
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = C.ink3
      ctx.globalAlpha = 0.8
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pA.x, pA.y)
      ctx.lineTo(pB.x, pB.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // 差值气泡（站点两端点小圆 + 中点铭牌）
      ctx.fillStyle = C.self
      ctx.beginPath(); ctx.arc(pA.x, pA.y, 4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = C.other
      ctx.beginPath(); ctx.arc(pB.x, pB.y, 4, 0, Math.PI * 2); ctx.fill()

      const mid = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 }
      const text = s.d.gap === 0 ? '同一处' : '差' + s.d.gap
      ctx.font = '10px Menlo, monospace'
      const tw = ctx.measureText(text).width + 10
      const th = 16
      const r = 3
      const bx = mid.x + 14
      const by = mid.y - th / 2
      ctx.beginPath()
      ctx.moveTo(bx - tw / 2 + r, by)
      ctx.arcTo(bx + tw / 2, by, bx + tw / 2, by + th, r)
      ctx.arcTo(bx + tw / 2, by + th, bx - tw / 2, by + th, r)
      ctx.arcTo(bx - tw / 2, by + th, bx - tw / 2, by, r)
      ctx.arcTo(bx - tw / 2, by, bx + tw / 2, by, r)
      ctx.closePath()
      ctx.fillStyle = C.card
      ctx.fill()
      ctx.strokeStyle = s.d.gap === 0 ? C.ink3 : C.ink
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = C.ink
      ctx.textAlign = 'center'
      ctx.fillText(text, bx, by + 12)
    })
  }
}

// ── 渲染器二：人群回声 3D 粒子群 ──────────────────────
/**
 * 每个粒子 = 一次真实的反应（认可 / 不认可）。
 * 认可者向左极聚集，不认可者向右极聚集，
 * MBTI 相同的人再往同一深度层靠 —— 群体倾向自己长出形状，
 * 这就是「群体智能」的视觉表达。
 *
 * @param {object} opts { w, h, yaw, pitch, mine:'agree'|'disagree'|null }
 */
function makeSwarm(counts, opts) {
  // counts: { agree: n, disagree: m, byType: {INTJ:{agree:1,disagree:0},...} }
  const parts = []
  const push = (att, type, isMine) => {
    parts.push({
      x: (att === 'agree' ? -1 : 1) * (1.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 2.2,
      y: (Math.random() - 0.5) * 1.7,
      z: (Math.random() - 0.5) * 1.7,
      vx: 0, vy: 0, vz: 0,
      att: att,
      type: type,
      mine: !!isMine
    })
  }
  const byType = counts.byType || {}
  Object.keys(byType).forEach((t) => {
    const g = byType[t]
    for (let i = 0; i < g.agree; i++) push('agree', t)
    for (let i = 0; i < g.disagree; i++) push('disagree', t)
  })
  // 数量太少时补环境粒子，保证画面成立（演示模式下由调用方传入合成数据）
  if (parts.length < 6 && counts.agree + counts.disagree > 0) {
    for (let i = 0; i < 12; i++) push(Math.random() < counts.agree / (counts.agree + counts.disagree) ? 'agree' : 'disagree', '····')
  }
  if (opts && opts.mine) push(opts.mine, opts.myType || '····', true)
  return parts
}

/** boids-lite：极点吸引 + 同伴分离 + 微噪声，dt 步进 */
function stepSwarm(parts, dt) {
  const pole = (p) => (p.att === 'agree' ? -2.1 : 2.1)
  const typeLayer = (p) => {
    // 用 MBTI 哈希到 4 个深度层，同类型的人聚在同一层
    const t = p.type || '····'
    const hash = (t.charCodeAt(0) + t.charCodeAt(t.length - 1) * 3) % 4
    return (hash - 1.5) * 0.62
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    // 吸引：向本方极点
    p.vx += (pole(p) - p.x) * 0.55 * dt
    p.vy += (0 - p.y) * 0.35 * dt
    p.vz += (typeLayer(p) - p.z) * 0.3 * dt
    // 分离：离得太近就推开（只查邻近 8 个，O(n²) 但 n 小）
    for (let j = i + 1; j < Math.min(parts.length, i + 9); j++) {
      const q = parts[j]
      const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < 0.1 && d2 > 0.0001) {
        const f = (0.1 - d2) * 0.9 * dt
        const inv = 1 / Math.sqrt(d2)
        p.vx += dx * inv * f; p.vy += dy * inv * f; p.vz += dz * inv * f
        q.vx -= dx * inv * f; q.vy -= dy * inv * f; q.vz -= dz * inv * f
      }
    }
    // 阻尼 + 微噪声（鱼群的“活着”感）
    const damp = Math.pow(0.02, dt)
    p.vx = p.vx * damp + (Math.random() - 0.5) * 0.16 * dt
    p.vy = p.vy * damp + (Math.random() - 0.5) * 0.12 * dt
    p.vz = p.vz * damp + (Math.random() - 0.5) * 0.1 * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
  }
}

function drawSwarm(ctx, parts, opts) {
  const w = opts.w
  const h = opts.h
  const cam = makeCamera({ yaw: opts.yaw, pitch: opts.pitch, distance: 6.4, focal: Math.min(w, h) * 1.5 })
  cam.cx = w / 2
  cam.cy = h / 2

  ctx.clearRect(0, 0, w, h)

  // ── 极点锚：立柱细线 + 底部铭牌（蓝图标注） ──
  const anchor = (wx, label, color) => {
    const top = project({ x: wx, y: 1.15, z: 0 }, cam)
    const bot = project({ x: wx, y: -0.9, z: 0 }, cam)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(bot.x, bot.y)
    ctx.stroke()
    // 顶帽
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(top.x - 6, top.y)
    ctx.lineTo(top.x + 6, top.y)
    ctx.stroke()
    ctx.globalAlpha = 1
    // 铭牌：白底色字
    ctx.font = '11px Menlo, monospace'
    const tw = ctx.measureText(label).width + 12
    ctx.beginPath()
    const r = 3
    ctx.moveTo(bot.x - tw / 2 + r, bot.y - 18)
    ctx.arcTo(bot.x + tw / 2, bot.y - 18, bot.x + tw / 2, bot.y - 2, r)
    ctx.arcTo(bot.x + tw / 2, bot.y - 2, bot.x - tw / 2, bot.y - 2, r)
    ctx.arcTo(bot.x - tw / 2, bot.y - 2, bot.x - tw / 2, bot.y - 18, r)
    ctx.closePath()
    ctx.fillStyle = C.card
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.fillText(label, bot.x, bot.y - 6)
  }
  anchor(-2.1, '认可', C.other)
  anchor(2.1, '不认可', C.self)

  // 粒子：按深度排序后画（近大远小），带细环
  const proj = parts.map((p) => ({ p, q: project(p, cam) }))
  proj.sort((a, b) => b.q.depth - a.q.depth)
  proj.forEach(({ p, q }) => {
    const r = Math.max(1.6, 165 * q.scale / cam.focal)
    ctx.beginPath()
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2)
    if (p.mine) {
      // 我的反应：墨色实心 + 朱红双环，一眼找到自己
      ctx.fillStyle = C.ink
      ctx.fill()
      ctx.strokeStyle = C.self
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(q.x, q.y, r + 3.5, 0, Math.PI * 2)
      ctx.strokeStyle = C.self
      ctx.globalAlpha = 0.4
      ctx.stroke()
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = p.att === 'agree' ? C.other : C.self
      ctx.globalAlpha = 0.3 + 0.5 * (1 / Math.max(q.depth - 3, 0.4))
      ctx.fill()
      ctx.globalAlpha = Math.min(0.5, 0.15 + 0.3 * (1 / Math.max(q.depth - 3, 0.4)))
      ctx.strokeStyle = p.att === 'agree' ? C.other : C.self
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  })
}

module.exports = {
  C: C,
  mix: mix,
  makeCamera: makeCamera,
  project: project,
  drawRuler3d: drawRuler3d,
  drawRidge3d: drawRidge3d,
  makeSwarm: makeSwarm,
  stepSwarm: stepSwarm,
  drawSwarm: drawSwarm
}
