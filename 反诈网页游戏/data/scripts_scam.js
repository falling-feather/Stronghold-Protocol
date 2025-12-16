// Day 3: FaceTime诈骗
DB.contacts["facetime_scam"] = { name: "00-8823(FaceTime)", avatar: ASSETS.facetime, type: "single", day: 3, initMsg: "顺丰理赔中心" };
// Day 7: 结局
DB.contacts["anti_fraud"] = { name: "国家反诈中心", avatar: ASSETS.app, type: "single", day: 7, initMsg: "您的反诈周报已生成" };

Object.assign(DB.scripts, {
    // === Day 3: 快递理赔 ===
    "facetime_scam_day3": {
        "start": { text: "您好，顺丰快递理赔中心。您尾号7890的包裹破损，我们将为您办理双倍理赔。请问是林晓晓女士吗？", next: "f1" },
        "f1": { text: "请打开支付宝搜索‘备用金’，那是我们的理赔通道。", next: "f2" },
        "f2": { text: "（支付宝显示备用金可领500元）\n客服：哎呀，多发放了411元！请下载‘Zoom’开启屏幕共享，我们指导您退回，否则影响征信。", next: "op_face" },
        "op_face": {
            options: [
                { text: "好的，我马上安装Zoom。", next: "fail_face" },
                { text: "备用金是借款功能吧？我直接在淘宝联系卖家。", next: "pass_face" }
            ]
        },
        "fail_face": {
            text: "（屏幕共享中，对方诱导你输入支付密码，进行‘安全测试转账’。转账后对方失联。）\n【系统提示】屏幕共享=共享密码！备用金并非理赔通道。",
            action: "scammed",
            isEnd: true
        },
        "pass_face": {
            text: "（挂断后核实包裹无破损。备用金是借贷产品。）\n【系统提示】陌生FaceTime一律挂断！快递理赔只通过官方平台进行。",
            action: "safe",
            isEnd: true
        }
    },

    // === Day 7: 大结局 ===
    "anti_fraud_day7": {
        "start": { 
            text: "【国家反诈中心】你的国庆七日反诈报告已生成！\n在享受班级群的温暖时，也要警惕外界的陷阱哦~", 
            next: "check_ending" 
        },
        "check_ending": {
            options: [
                { text: "查看我的反诈成绩单", next: "ending_logic" }
            ]
        },
        "ending_logic": {
            text: "正在分析你的国庆假期表现...",
            action: "check_score",
            isEnd: true
        }
    }
});