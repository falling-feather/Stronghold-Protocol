// Day 2: 前同事
DB.contacts["colleague_ting"] = { name: "张婷(前同事)", avatar: ASSETS.colleague, type: "single", day: 2, initMsg: "睡了吗？有个事难以启齿..." };
// Day 4: 杀猪盘
DB.contacts["alex"] = { name: "Alex_金融", avatar: ASSETS.alex, type: "single", day: 4, initMsg: "[图片] 今天的收益不错" };
// Day 5 & 7: 大顺表哥
DB.contacts["uncle_dashun"] = { name: "大顺表哥", avatar: ASSETS.uncle, type: "single", day: 5, initMsg: "大侄子" };
// Day 6: AI换脸
DB.contacts["cousin_ai"] = { name: "表姐", avatar: ASSETS.cousin_sis, type: "single", day: 6, initMsg: "[视频通话] 请求..." };

Object.assign(DB.scripts, {
    // === Day 2: 深夜借款 ===
    "colleague_ting_day2": {
        "start": { text: "睡了吗？有个事真的难以启齿…我妈妈确诊了，现在在医院等着做手术。", next: "t1" },
        "t1": { text: "[图片] (诊断报告：王秀兰 急性心梗)\n我把存款都交了，还差8000。在深市我就你一个信得过的朋友了…", next: "t2" },
        "t2": { text: "[语音] (带着哭腔) 我知道这么晚找你不好…但这催款单…", next: "op_ting" },
        "op_ting": {
            options: [
                { text: "婷婷别哭，我马上转！", cost: 8000, next: "fail_ting" },
                { text: "阿姨在哪家医院？我先视频看看环境。", next: "pass_ting" }
            ]
        },
        "fail_ting": {
            text: "（三天后发现张婷微信被盗，诊断书是伪造的。骗子专挑深夜利用同情心下手。）\n【系统提示】深夜+紧急用钱=诈骗高发公式。",
            action: "scammed",
            isEnd: true
        },
        "pass_ting": {
            text: "（对方以‘医院信号不好’拒绝视频，并表现急躁。我随即联系共同好友核实，戳破骗局。）\n【系统提示】拒绝实时视频验证，诈骗概率99%。",
            action: "safe",
            isEnd: true
        }
    },

    // === Day 4: 杀猪盘 ===
    "alex_day4": {
        "start": { text: "宝贝，交易所风控总监透露，黄金期货有个短期波动窗口。我自己已经入仓了，你要不要也放点零花钱？我帮你操作。", next: "a1" },
        "a1": { text: "[图片] (交易平台显示盈利15%) 这是我助理的账户，就放了5万试试水。可惜你不在身边，不然手把手教你看K线图。", next: "op_alex" },
        "op_alex": {
            options: [
                { text: "我相信你的判断，我有3万闲钱。", cost: 30000, next: "fail_alex" },
                { text: "投资我不太懂。下周我去深圳出差，我们见面你当面教我？", next: "pass_alex" }
            ]
        },
        "fail_alex": {
            text: "（下载APP首次投入3万，显示盈利但无法提现。缴纳‘个税’后APP无法登录，Alex失联。）\n【系统提示】杀猪盘公式：完美人设+小利诱惑+大额收割。",
            action: "scammed",
            isEnd: true
        },
        "pass_alex": {
            text: "（Alex以‘公司规定严格’、‘在香港出差’推脱，并表现急迫。我停止回复，该账号一周后被封。）\n【系统提示】网络交友三原则：不确认身份不见面，谈及理财即警惕。",
            action: "safe",
            isEnd: true
        }
    },

    // === Day 5 & 7: 大顺表哥 ===
    "uncle_dashun_day5": {
        "start": { text: "大侄子，忙着没？表哥跟你张个口。我这只要2000块钱周转一下，给工人发个生活费。下周二立马还你。行不？", next: "u_decide" },
        "u_decide": {
            options: [
                { text: "行，都是亲戚，转你 (支付2000)", cost: 2000, next: "u_paid" },
                { text: "表哥我真没钱，还是学生呢", next: "u_refuse" }
            ]
        },
        "u_paid": { text: "好兄弟！帮大忙了！下周二准时还你！(其实你再也收不到了)", isEnd: true },
        "u_refuse": { text: "那好吧，也挺不好意思的，不打扰了。", action: "flag_refuse_dashun", isEnd: true }
    },
    // 大顺 Day 7 回归版
    "uncle_dashun_return_day7": {
        "start": { text: "大侄子... 哎呀我是真头疼啊。工人都堵我家门口了。你要是能帮就帮衬帮衬好不好？就1000也行。", next: "ur_op" },
        "ur_op": {
            options: [
                { text: "看着太心酸了，借吧 (支付1000)", cost: 1000, next: "ur_paid" },
                { text: "表哥，我报警了啊", next: "ur_block" }
            ]
        },
        "ur_paid": { text: "谢谢！你是我的救命恩人！(结局：钱没了)", isEnd: true },
        "ur_block": { text: "别别别... 我自己想办法。", isEnd: true }
    },

    // === Day 6: AI换脸 ===
    "cousin_ai_day6": {
        "start": { text: "（接通视频）妹妹，能听见吗？我闺蜜老公出车祸了，需要5万急救费，我卡被冻结了，你能不能先转给我，我明天一早就还你？", next: "ai1" },
        "ai1": { text: "（表姐背景在酒店，耳环偶尔闪烁，下颌边缘有轻微像素扭曲）\n快一点，真的很急！", next: "op_ai" },
        "op_ai": {
            options: [
                { text: "好，你把账号发我。", cost: 50000, next: "fail_ai" },
                { text: "表姐，你用手在脸前挥一下。还有，我去年送你的生日礼物是什么？", next: "pass_ai" }
            ]
        },
        "fail_ai": {
            text: "（转账后联系真正表姐，得知其微信号被盗。骗子利用AI换脸和语音合成实施诈骗。）\n【系统提示】异常急切的情绪是诈骗标志，视频转账也要验证隐私问题。",
            action: "scammed",
            isEnd: true
        },
        "pass_ai": {
            text: "（对方画面出现明显卡顿和逻辑错误，随后匆忙挂断。）\n【系统提示】AI难以实时渲染手部遮挡。多问隐私问题可破局。",
            action: "safe",
            isEnd: true
        }
    }
});