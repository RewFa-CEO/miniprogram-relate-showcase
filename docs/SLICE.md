# 切片边界说明

本仓库由完整应用的私有仓库**切片**而来。这份文档说明：切了什么、为什么不切、以及哪些数字属于完整应用而不属于本仓库。

## 一、公开了什么

| 路径 | 内容 | 来源 |
|---|---|---|
| `src/chart3d.js` | Canvas 2D 手写 3D 投影引擎 | 私有仓 `utils/chart3d.js`，**逐字未改** |
| `src/persona.js` | 双人同轴对照 | 私有仓 `utils/persona.js`，逐字未改 |
| `src/quiz.js` | 动态题库与权重削峰 | 私有仓 `utils/quiz.js`，逐字未改 |
| `src/ai-bank.js` | 题库种子 | 私有仓 `utils/ai-bank.js`，逐字未改 |
| `src/mbti.js` | MBTI 计分 | 私有仓 `utils/mbti.js`，逐字未改 |
| `src/style.js` | 风格 / 需求计分 | 私有仓 `utils/style.js`，逐字未改 |
| `src/relation.js` | 结构化对照 | 私有仓 `utils/relation.js`，逐字未改 |
| `src/tone.js` | 今日沟通色调 | 私有仓 `utils/tone.js`，逐字未改 |
| `test/engine.test.js` | 15 个回归测试 | **新写**，用于锁定可验证主张 |
| `demo/` | 浏览器演示页 | **新写**，调用上面同一份模块 |
| `scripts/build-demo.cjs` | CommonJS → 浏览器 bundle | **新写**，只做 `require` 替换，不做转译 |

> 源码逐字未改是有意的：**演示页跑的就是仓库里的代码**，不是另写一份好看的实现。

## 二、为什么不公开

| 不公开的东西 | 原因 |
|---|---|
| 小程序页面与云函数（`pages/`、`cloudfunctions/`） | 应用外壳含部署配置、业务逻辑与第三方 API 调用形态；公开后等于把线上结构摊开给爬虫看 |
| 知识库全文（`knowledge.js`，25 万字符） | 内容是第三方出版物的全文（书籍章节 + arXiv 论文），**不是自有作品**，不能随 MIT 协议再分发 |
| 竞品逆向研究（`docs/research/competitors/`） | 属第三方产品的分析结论，对外发布存在合规风险 |
| 业务策略与运营文档（`BUSINESS-STRATEGY.md`、`nuri-strategy-onepager.md`） | 商业判断，不属于公开作品 |
| 循环任务与运营状态（`docs/loop-task/`） | 运行时状态与提示词，无公开价值 |
| 真实用户数据、账号、密钥 | 已在私有仓 `.gitignore` 中拦截（`cloudbaserc.json`、`.env`、`*.key`、`*.pem` 永不入库） |

## 三、数字口径：哪些属于完整应用

本仓库**不包含**完整应用的任何生产指标。完整应用侧的量级（如题库规模、云端缓存命中率等）留在私有仓，不在此声明。

本仓库自己可验证的量只有：

| 量 | 值 | 怎么验 |
|---|---|---|
| 公开模块数 | 8 | `ls src/` |
| 回归测试数 | 15 | `npm test` |
| 题库种子规模 | MBTI 16 题 / 风格 6 题 / 需求 4 组 | `src/ai-bank.js` |
| 人格对照维度 | 4 轴 | `src/persona.js` `AXIS_META` |
| 风格维度 / 需求组 | 6 维 / 4 组 | `src/style.js` |
| 参考分区间 | 30-95（截断） | `src/relation.js` |

## 四、引用私有仓文档的地方

`src/` 里若干注释提到私有仓的文档（如 `docs/dynamic-quiz-rules.md`、`cloudfunctions/profileApi/knowledge.js`）。这些引用保留原样，因为它们说明了规则出处；对应文件不在本仓库，需要了解可联系作者。
