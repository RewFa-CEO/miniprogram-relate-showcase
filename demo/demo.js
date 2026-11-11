/**
 * 公开切片 demo —— 直接调用仓库 src/ 里的同一份算法模块。
 * bundle.js 由 scripts/build-demo.cjs 生成（只把 require 换成模块表引用）。
 */
;(function () {
  'use strict'

  var R = window.RELATE
  if (!R) {
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<p style="color:#f88">bundle.js 没生成，先跑 <code>npm run build:demo</code></p>'
    )
    return
  }

  var STYLE_KEYS = Object.keys(R.aiBank.style.reduce(function (acc, q) {
    acc[q.key] = 1
    return acc
  }, {}))
  var NEED_KEYS = Object.keys(R.aiBank.need.reduce(function (acc, q) {
    acc[q.key] = 1
    return acc
  }, {}))

  function profile(o) {
    var style = {}
    STYLE_KEYS.forEach(function (k) { style[k] = o.style[k] })
    var need = {}
    NEED_KEYS.forEach(function (k) { need[k] = o.need[k] })
    return {
      mbti: o.mbti,
      axes: o.axes,
      axisScores: o.axisScores,
      style: style,
      need: need
    }
  }

  var A = profile({
    mbti: 'ESTJ',
    axes: { ei: 0, sn: 0, tf: 0, jp: 0 },
    axisScores: { ei: 100, sn: 100, tf: 100, jp: 100 },
    style: { express: 1, initiative: 2, focus: 1, reply: 2, emotion: 1, conflict: 2 },
    need: { quality: 0, recognition: 1, support: 0, ritual: 1 }
  })

  var B = profile({
    mbti: 'INFP',
    axes: { ei: 1, sn: 1, tf: 1, jp: 1 },
    axisScores: { ei: 100, sn: 100, tf: 100, jp: 100 },
    style: { express: 3, initiative: 3, focus: 3, reply: 3, emotion: 3, conflict: 3 },
    need: { quality: 1, recognition: 0, support: 1, ritual: 0 }
  })

  /* ── 3D 叠尺 ── */
  var canvas = document.getElementById('c')
  var ctx = canvas.getContext('2d')
  var yaw = -0.55
  var pitch = 0.42
  var rows = R.persona.dualScales(A, B)

  function paint() {
    var dpr = window.devicePixelRatio || 1
    var cssW = canvas.clientWidth || 640
    var cssH = Math.round(cssW * 0.69)
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
    canvas.style.height = cssH + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = R.chart3d.C.paper
    ctx.fillRect(0, 0, cssW, cssH)
    R.chart3d.drawRuler3d(ctx, rows, {
      w: cssW,
      h: cssH,
      yaw: yaw,
      pitch: pitch,
      showLabels: true
    })
  }

  var drag = null
  canvas.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch }
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return
    yaw = drag.yaw + (e.clientX - drag.x) * 0.008
    pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.006))
    paint()
  })
  canvas.addEventListener('pointerup', function () { drag = null })
  canvas.addEventListener('pointercancel', function () { drag = null })
  window.addEventListener('resize', paint)

  /* ── 同轴对照条 ── */
  var axesEl = document.getElementById('axes')
  rows.forEach(function (r) {
    var row = document.createElement('div')
    row.className = 'row'
    row.innerHTML =
      '<div class="lab">' + r.label + ' ' + r.code + '</div>' +
      '<div class="track">' +
      '<div class="span" style="left:' + r.spanLeft + '%;width:' + r.spanWidth + '%"></div>' +
      '<div class="pt a" style="left:' + r.aPos + '%"></div>' +
      '<div class="pt b" style="left:' + r.bPos + '%"></div>' +
      '</div>' +
      '<div class="gap">落差 ' + r.gap + '</div>'
    axesEl.appendChild(row)
  })

  var sum = R.persona.dualSummary(rows)
  document.getElementById('summary').innerHTML =
    '一致 <b>' + sum.same + '</b> 处 · 落差 <b>' + sum.diff + '</b> 处 · 平均落差 <b>' + sum.avgGap + '</b>'

  /* ── 结构化对照 ── */
  var report = R.relation.analyze(A, B)
  var dimsEl = document.getElementById('dims')
  var names = { love: '亲密', communicate: '沟通', live: '日常', grow: '成长' }
  Object.keys(report.dims).forEach(function (k) {
    var dt = document.createElement('dt')
    dt.textContent = names[k] || k
    var dd = document.createElement('dd')
    dd.textContent = report.dims[k] + ' / 100'
    dimsEl.appendChild(dt)
    dimsEl.appendChild(dd)
  })
  var tot = document.createElement('dt')
  tot.textContent = '综合'
  var totd = document.createElement('dd')
  totd.innerHTML = '<b>' + report.total + '</b> / 100'
  dimsEl.appendChild(tot)
  dimsEl.appendChild(totd)

  var t = R.tone.toneFor(report)
  document.getElementById('tone').innerHTML =
    '今日沟通色调 · <b>' + t.name + '</b> —— ' + t.action

  paint()
})()
