/**
 * 测量题库（初始种子缓存）。
 * 内容 100% 由 MiniMax-M3.1-Flash 于 2026-10-25 生成，提示词带全文知识库
 * （见 cloudfunctions/profileApi/knowledge.js），生成后过结构+合规校验。
 *
 * 动态题库约定（docs/dynamic-quiz-rules.md）：
 *   id      全库唯一，种子题 m_<维>_<序> / s_<维>_<序> / n_<组>_<序>，AI 新题 g_ 前缀
 *   weight  AI 给的信息权重 1-5（换算表见 utils/quiz.js，种子分值由 AI 实测评定）
 *   anchor  锚题：每维 1 道，永不被替换、永不退役、每张卷必在（跨版本可比的定盘星）
 * 云端真源是 quiz_bank 集合（一题一文档），本文件 = 冷启动种子 + 锚题出处。
 */
module.exports = {
  "mbti": [
    {
      "id": "m_ei_1",
      "key": "ei",
      "anchor": true,
      "weight": 4,
      "text": "遇到聚会邀约的时候，我会怎么做？",
      "options": [
        "我会答应赴约并与人互动",
        "我会婉拒邀约，独自休息"
      ]
    },
    {
      "id": "m_ei_2",
      "key": "ei",
      "weight": 5,
      "text": "遇到熟人聚会的时候，我会怎么做？",
      "options": [
        "我会主动找人聊天",
        "我会待在安静处观察"
      ]
    },
    {
      "id": "m_ei_3",
      "key": "ei",
      "weight": 5,
      "text": "遇到连续独处两天的时候，我会怎么做？",
      "options": [
        "我会主动约人见面",
        "我会关掉消息，独自休息"
      ]
    },
    {
      "id": "m_ei_4",
      "key": "ei",
      "weight": 4,
      "text": "遇到聚会散场的时候，我会怎么做？",
      "options": [
        "我会留下来继续聊天",
        "我会尽快离开，找个安静地方"
      ]
    },
    {
      "id": "m_sn_1",
      "key": "sn",
      "anchor": true,
      "weight": 4,
      "text": "遇到一项新计划的时候，我会先做什么？",
      "options": [
        "先确认每一步具体怎么做",
        "先想它还可以有哪些可能"
      ]
    },
    {
      "id": "m_sn_2",
      "key": "sn",
      "weight": 3,
      "text": "遇到别人描述问题时，我会先做什么？",
      "options": [
        "先追问问题具体表现",
        "先寻找问题背后的模式"
      ]
    },
    {
      "id": "m_sn_3",
      "key": "sn",
      "weight": 5,
      "text": "遇到需要做选择的时候，我会先看什么？",
      "options": [
        "已经验证的事实",
        "未来可能的方向"
      ]
    },
    {
      "id": "m_sn_4",
      "key": "sn",
      "weight": 4,
      "text": "遇到有人讲抽象概念的时候，我会怎么做？",
      "options": [
        "先追问一个具体例子",
        "先联想它可能意味着什么"
      ]
    },
    {
      "id": "m_tf_1",
      "key": "tf",
      "anchor": true,
      "weight": 4,
      "text": "遇到意见不一致的时候，我会先做什么？",
      "options": [
        "先核对哪个方案更有效",
        "先确认彼此感受是否被理解"
      ]
    },
    {
      "id": "m_tf_2",
      "key": "tf",
      "weight": 5,
      "text": "遇到朋友诉说烦恼的时候，我会先做什么？",
      "options": [
        "先梳理可以解决的问题",
        "先回应对方此刻的感受"
      ]
    },
    {
      "id": "m_tf_3",
      "key": "tf",
      "weight": 5,
      "text": "遇到限时选择的时候，我会按什么排序？",
      "options": [
        "按客观标准排序",
        "按对人的影响排序"
      ]
    },
    {
      "id": "m_tf_4",
      "key": "tf",
      "weight": 4,
      "text": "遇到同伴犯错的时候，我会先做什么？",
      "options": [
        "先指出事实和影响",
        "先确认对方在意什么"
      ]
    },
    {
      "id": "m_jp_1",
      "key": "jp",
      "anchor": true,
      "weight": 5,
      "text": "遇到周末要安排的时候，我会怎么做？",
      "options": [
        "提前定好时间地点",
        "临近时再决定做什么"
      ]
    },
    {
      "id": "m_jp_2",
      "key": "jp",
      "weight": 4,
      "text": "遇到多项任务的时候，我会怎么做？",
      "options": [
        "按计划逐项完成",
        "跟着当下状态调整顺序"
      ]
    },
    {
      "id": "m_jp_3",
      "key": "jp",
      "weight": 5,
      "text": "遇到临时邀约的时候，我会怎么做？",
      "options": [
        "优先保留原计划",
        "打乱原计划去尝试"
      ]
    },
    {
      "id": "m_jp_4",
      "key": "jp",
      "weight": 5,
      "text": "遇到规划长途出行的时候，我会怎么做？",
      "options": [
        "提前安排好各项细节",
        "边走边决定临时安排"
      ]
    }
  ],
  "style": [
    {
      "id": "s_express_1",
      "key": "express",
      "anchor": true,
      "weight": 4,
      "title": "表达方式",
      "note": "遇到对方问你意见的时候，",
      "options": [
        "我会马上把想法说出来",
        "我会先说重点，再慢慢补充",
        "我会等到合适时机再说",
        "我会把话憋在心里不说"
      ]
    },
    {
      "id": "s_initiative_1",
      "key": "initiative",
      "anchor": true,
      "weight": 5,
      "title": "主动程度",
      "note": "遇到几天没联系朋友的时候，",
      "options": [
        "我会当天主动联系",
        "我会隔一两天主动联系",
        "我想起来才会主动联系",
        "我通常等对方先联系"
      ]
    },
    {
      "id": "s_focus_1",
      "key": "focus",
      "anchor": true,
      "weight": 4,
      "title": "注意分配",
      "note": "遇到几件事同时压来的时候，",
      "options": [
        "我只专心做完一件事",
        "我会做主任务，偶尔插做小事",
        "我会在几件事之间来回切换",
        "我会同时盯着很多件事"
      ]
    },
    {
      "id": "s_reply_1",
      "key": "reply",
      "anchor": true,
      "weight": 4,
      "title": "回应节奏",
      "note": "遇到对方发来消息的时候，",
      "options": [
        "我通常几秒内就回复",
        "我通常过一会儿再回复",
        "我通常忙完手头事再回复",
        "我常常隔很久才回复"
      ]
    },
    {
      "id": "s_emotion_1",
      "key": "emotion",
      "anchor": true,
      "weight": 5,
      "title": "情绪可见",
      "note": "遇到情绪波动的时候，",
      "options": [
        "我会让对方一眼看出来",
        "我会主动说出自己的感受",
        "我会淡淡回应，不多解释",
        "我会把情绪完全藏起来"
      ]
    },
    {
      "id": "s_conflict_1",
      "key": "conflict",
      "anchor": true,
      "weight": 5,
      "title": "冲突处理",
      "note": "遇到争执刚发生的时候，",
      "options": [
        "我会当场把问题说清楚",
        "我会先说感受，暂不展开",
        "我会先暂停，让自己冷静",
        "我会尽量避开当面讨论"
      ]
    }
  ],
  "need": [
    {
      "id": "n_quality_1",
      "key": "quality",
      "anchor": true,
      "weight": 5,
      "label": "相处质量偏好",
      "options": [
        {
          "text": "遇到周末时，我想要专注陪伴",
          "tag": "陪伴"
        },
        {
          "text": "遇到周末时，我想要各自空间",
          "tag": "空间"
        }
      ]
    },
    {
      "id": "n_recognition_1",
      "key": "recognition",
      "anchor": true,
      "weight": 4,
      "label": "被认可方式偏好",
      "options": [
        {
          "text": "遇到别人评价时，我想要具体肯定",
          "tag": "肯定"
        },
        {
          "text": "遇到别人评价时，我更想先被共情",
          "tag": "共情"
        }
      ]
    },
    {
      "id": "n_support_1",
      "key": "support",
      "anchor": true,
      "weight": 5,
      "label": "关系支持方式",
      "options": [
        {
          "text": "遇到难题时，我想要有人听我倾诉",
          "tag": "倾听"
        },
        {
          "text": "遇到难题时，我想要直接方案",
          "tag": "方案"
        }
      ]
    },
    {
      "id": "n_ritual_1",
      "key": "ritual",
      "anchor": true,
      "weight": 4,
      "label": "相处仪式偏好",
      "options": [
        {
          "text": "遇到日常时，我想要不定的小惊喜",
          "tag": "惊喜"
        },
        {
          "text": "遇到日常时，我更想保留固定日常",
          "tag": "日常"
        }
      ]
    }
  ],
  "statements": [
    {
      "id": "st_boundary",
      "text": "遇到亲近的人越界时，我通常先说明界限",
      "tag": "边界"
    },
    {
      "id": "st_emotion",
      "text": "遇到情绪涌上来时，我通常先说清感受",
      "tag": "情绪"
    },
    {
      "id": "st_order",
      "text": "遇到临时变动时，我通常先把事情安排好",
      "tag": "秩序"
    },
    {
      "id": "st_expression",
      "text": "遇到要表达观点时，我通常先想清再说",
      "tag": "表达"
    },
    {
      "id": "st_conflict",
      "text": "遇到意见不合时，我通常先冷静再沟通",
      "tag": "冲突"
    },
    {
      "id": "st_ritual",
      "text": "遇到日常相处时，我更看重稳定的小仪式",
      "tag": "仪式"
    },
    {
      "id": "st_growth",
      "text": "遇到共同难题时，我愿意一起找新办法",
      "tag": "成长"
    },
    {
      "id": "st_trust",
      "text": "遇到对方承诺时，我通常先看持续行动",
      "tag": "信任"
    }
  ]
}
