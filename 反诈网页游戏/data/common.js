const ASSETS = {
    me: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    // 社交类
    colleague: "https://api.dicebear.com/7.x/avataaars/svg?seed=TingTing", // 张婷
    alex: "https://api.dicebear.com/7.x/micah/svg?seed=Alex", // 杀猪盘男主
    cousin_sis: "https://api.dicebear.com/7.x/avataaars/svg?seed=CousinSis", // 表姐
    uncle: "https://api.dicebear.com/7.x/avataaars/svg?seed=Uncle", // 大顺
    // 工作类
    boss: "https://api.dicebear.com/7.x/micah/svg?seed=BossLi", // 李总
    // 诈骗/陌生人
    aunt: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aunt", // 大舅妈
    facetime: "https://api.dicebear.com/7.x/identicon/svg?seed=SF", // 顺丰理赔
    app: "https://api.dicebear.com/7.x/identicon/svg?seed=App", // 反诈APP
    // 群图标
    family_group: "https://api.dicebear.com/7.x/identicon/svg?seed=Family",
    work_group: "https://api.dicebear.com/7.x/identicon/svg?seed=Work",
    class_group: "https://api.dicebear.com/7.x/identicon/svg?seed=SoftEng1",
    // 班级群成员头像
    bierrari: "https://api.dicebear.com/7.x/micah/svg?seed=Bierrari",
    yangshuai: "https://api.dicebear.com/7.x/avataaars/svg?seed=YangShuai",
    mumusan: "https://api.dicebear.com/7.x/micah/svg?seed=MuMuSan",
    ben: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben",
    x: "https://api.dicebear.com/7.x/micah/svg?seed=X",
    l: "https://api.dicebear.com/7.x/avataaars/svg?seed=L",
    tong: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tong",
    fifteen_jin: "https://api.dicebear.com/7.x/micah/svg?seed=FifteenJin",
    reze: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reze"
};

const GROUP_MEMBERS = {
    "family_group": {
        "aunt": { name: "大舅妈", avatar: ASSETS.aunt },
        "uncle": { name: "大舅", avatar: "https://api.dicebear.com/7.x/micah/svg?seed=Uncle" },
        "sis_mom": { name: "小姨", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SisMom" }
    },
    "work_group": {
        "boss": { name: "李总", avatar: ASSETS.boss },
        "wang": { name: "王董", avatar: "https://api.dicebear.com/7.x/micah/svg?seed=Wang" }
    },
    "class_group": {
        "bierrari": { name: "Bierrari", avatar: ASSETS.bierrari },
        "yangshuai": { name: "杨帅", avatar: ASSETS.yangshuai },
        "mumusan": { name: "地道杭州人 木木三", avatar: ASSETS.mumusan },
        "ben": { name: "早睡学长奔", avatar: ASSETS.ben },
        "x": { name: "追慕埃克斯", avatar: ASSETS.x },
        "l": { name: "L", avatar: ASSETS.l },
        "tong": { name: "彤", avatar: ASSETS.tong },
        "fifteen_jin": { name: "我的十五斤肉", avatar: ASSETS.fifteen_jin },
        "reze": { name: "班助 Reze", avatar: ASSETS.reze }
    }
};

const DB = {
    contacts: {},
    scripts: {}
};