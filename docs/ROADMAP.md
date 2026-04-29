# 长期路线图（Roadmap）

目标：以「明日方舟·卫戍协议（PRTS Wiki）」为蓝本，逐步 1:1 实现核心机制并扩展为可联机的塔防 Roguelike。

参考来源：<https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%EF%BC%9A%E7%9B%9F%E7%BA%A6>

---

## v1.x — 框架与数据扩展

- [x] v1.0.0 独立仓库
- [x] v1.1.0 地图路径全地面 + 自动校验
- [x] v1.2.0 干员模板：职业 / 天赋 / 技能多档（叠层影响数值）
- [x] v1.3.0 阵营选择页 + 阵容编排页
- [x] v1.4.0 联机模式占位
- [x] v1.5.0 ShopSystem 提取（商店/合并/临时商店/出售迁出 GameEngine）
- [x] v1.5.1 UI 多页面化：main.ts 拆分至 src/screens/{Start,Faction,Roster,Multiplayer,Game}Screen.ts

## v2.x — 战斗系统深化

- [x] v2.0.0 技能主动释放（手动点按）：详情面板显示 SP 条与"释放技能"按钮，持续型技能在 duration 期间生效（atkMul / aspdPct）；瞬发型暂未支持
- [x] v2.1.0 攻击类型：物理（atk-def，最低 5%）/ 法术（atk*(1-MR%)，最低 5%）/ 真伤（穿透）/ 治疗（v2.1.1 接入友军选择）；BaseStats.magicResist + OperatorTemplate.atkType + Projectile.atkType
- [x] v2.1.1 敌人 magicResist 配平：源石虫 0 / 步兵 30 / 大盾兵 60
- [x] v2.2.0 部署费用回流机制（先锋职业）：部署 30 秒后返还 cost 的 50%；详情面板倒计时显示
- [x] v2.3.0 增益/减益效果框架（Buff/Debuff）：StatusEffect{stat,mod,modType:flat|pct,duration,remaining,kind}，Operator/Enemy.effects 列表；GameEngine.applyEffectToOperator/applyEffectToEnemy + 内部 tickEffects/modifyStat；详情面板列出激活效果；开发期 window.engine 暴露便于验证
- [x] v2.3.1 skill atkMul/aspdPct 改造接入 effects：tryActivateSkill 时直接 push 到 op.effects，由 modifyStat 统一计算；fireProjectile/updateOperators 移除内联分支
- [x] v2.3.2 天赋接入 effects：atk_pct/def_pct/aspd_pct/block_plus 在部署时 push 为 duration=-1 的永久 effects；hp_pct 仍在 applyTalentsToStats 烘焙；新增 buildTalentEffects；StatusStat 扩展 'blockCount'；tickEffects 跳过永久效果；blockCount 走 modifyStat
- [x] v2.4.0 敌人特性框架（飞行 / 隐身 / 召唤 / Boss 阶段）：EnemyTraits{flying,stealth,summon,bossPhase} 接入 ENEMY_DB；目标过滤（飞行需高地；隐身需特种）；Boss 阶段用 v2.3.0 effects 触发；死亡召唤；新增飞虫敌人；Renderer 飞行投影 / 隐身半透明 / Boss 红环
- [x] v2.4.1 隐身敌人 + 特种干员模板：新增潜行刺客（stealth）与影刃（class:specialist, placement:ground）；隐身波次接入 WAVES

## v3.x — 盟约叠层

> 设计文档：[PACT_DESIGN.md](PACT_DESIGN.md)

- [x] v3.0.0-design 盟约叠层设计文档：PactDefinition/PactRuntime/onPactEvent/reconcile/tick decay 框架；事件源映射（kill/deploy/retreat/wave_clear）；与 v2.3.0 effects 复用约定
- [x] v3.0.0 框架落地 + 三盟约（含 v3.0.1 余音、v3.0.2 碎铳之簧）：炎佑(kill_any → atk +5%/10%/15%)、余音(wave_perfect → aspd -5%/10%/15%)、碎铳之簧(retreat_any 累积 + 5s/层衰减 → atk +10%/20%/30%)；tickPactDecay 接入 update；顶栏徽记 UI
- [x] v3.1.0 开局盟约选择 UI + 5 个盟约：新增 PactScreen（阵营确认 → 选 1-2 个盟约 → 出战）；GameEngine 构造器接受 activePactIds；新增「高翔之狩」(kill_flying → atk +5%/12%/20%) 与「钢铁誓约」(deploy_any → def +5/12/25 flat)
- [x] v3.2.0 誓约枷锁（负面盟约）：PactDefinition 新增 penalty/penaltyDesc；getActivePactEffectsForOperator 部署时无视 tier 附加 penalty 至干员；PactScreen 卡片显示 ⛓ 红色枷锁段；5 盟约各配代价（炎佑 def-3 / 余音 mr-5 / 碎铳之簧 def-5 / 高翔之狩 mr-3 / 钢铁誓约 atk-8%）
- [x] v3.2.1 枷锁可选开关：每个盟约可在 PactScreen 切换「普通/枷锁」模式（默认普通）；枷锁模式 = 阈值 ×0.7 上取整 + penalty 生效；PactRuntime.shackled / PactSelection 类型；GameEngine 构造器接受 PactSelection[]；徽记加 ⛓ 标记 + 红边
- [x] v3.2.2 视觉反馈：PactRuntime.lastTierUpAt / lastStackChangeAt 时间戳；CSS @keyframes pact-tier-up（升阶金光脉冲）+ pact-stack-bump（叠层小弹跳）；renderPactBadges 按时间戳挂 class
- [x] v3.3.0 盟约共鸣：RESONANCE_DB（reso_flame_storm 炎佑+空中猎手→atk +8% / reso_iron_echo 钢铁誓约+余音回响→magicResist +8）；GameEngine.activeResonances 集合 + reconcileResonances 差量应用；getActivePactEffectsForOperator 叠加；UI 顶栏激活时显示金色 ✦ 徽记（含闪光）
- [x] v3.3.1 共鸣扩展 + 设计文档：新增 reso_wind_blade（碎铳+空中猎手→aspd -8%）/ reso_oath_flame（炎佑+钢铁誓约→def +3）；docs/PACT_DESIGN.md 追加第 5 章「盟约共鸣」
- [x] v3.3.2 PactScreen 共鸣预览：选择阶段扫描 RESONANCE_DB，列出当前 selections 可能触发的共鸣（金色胶囊条 + tooltip 显示 tier 要求）
- [x] v3.3.3 共鸣枷锁加成：PactResonance.shackledBoosts；4 个共鸣均开启；engine activeResonances 改为 Map<id,boost>，boost=true 时 effects 复制一份（翻倍）；getActivePactEffectsForOperator 同步翻倍；UI 翻倍版徽记/预览胶囊改红金渐变 + ⛓×2 标记
- [x] v3.3.4 文档收束：docs/PACT_DESIGN.md 追加第 6 章「共鸣的枷锁加成」（数据/运行时/翻倍机制/UI/设计准则）
- [x] v3.4.0 PACT_PICK_MAX 提至 3：玩家可同时携带 3 个盟约，最多触发 2~3 个共鸣（5 pact × 4 共鸣覆盖关系下，3 选最多覆盖 2 共鸣）；为后续平衡调优预留空间
- [x] v3.4.1 共鸣全覆盖：新增 4 个共鸣（凤刃/铁穹/余风/余簧），10 对中覆盖 8 对；任何 3 选必触发 ≥2 共鸣（数学验证 10 个 3-子集均≥2）
- [x] v3.4.2 共鸣 10 对全覆盖：新增焰响（炎佑+余音→mr+5）/ 铁簧（钢铁+碎铳→atk+4），10 共鸣覆盖全部 C(5,2)=10 对；任何 3 选必触发 3 共鸣
- [x] v3.5.0 事件卡：每波结束后 50% 概率随机弹出事件卡，玩家从 3 个选项中选 1 项，影响金钱 / 全员 SP / 盟约 stack；首批 5 张事件（神秘商人 / 流浪法师 / 战场遗物 / 黑市交易 / 老兵的告诫）
- [x] v3.5.2 事件卡品质与权重：EventCard 增 rarity（common/rare/epic）+ weight，rollEvent 改加权抽取（默认 100/35/10）；新增 3 张 epic 事件（远古祭坛 / 先知的启示 / 宝箱），高品事件加成更强；modal UI 按 rarity 着色边框/标签
- [x] v3.5.3 事件日志面板：GameEngine.eventHistory 记录本局已触发事件 + 所选选项；顶栏「📜 N」按钮可点击弹出历史 modal，按品质色分组列表展示
- [x] v3.5.4 事件波次联动：EventCard 新增 minWave/maxWave/once/cooldown；rollEvent 支持按 currentWave + history 过滤；3 张 epic 设 once+minWave（祭坛 5/启示 4/宝箱 3），黑市 cooldown:3
- [x] v3.6.0 跨局碎片货币 + meta 升级树：localStorage 永久保存（sp_meta_v1）；4 项升级（启动资金/盟约预热/神秘指引/初始法力）；碎片产出（每波+4、perfect+2、通关+50、史诗事件+15、失败折半）；主菜单新增「⬢ 升级树」入口，节点式购买
- [x] v3.6.1 升级树扩充 + 前置依赖：MetaUpgrade 新增 prereq 字段；新增 4 项二级升级（坚壁计划/物流优势/韧链/深渊低语）；前置未满足时卡片置灰显示「🔒 需要：xx Lv.N」；GameEngine 应用起始生命/盟约衰减缩放/商店折扣/epic 权重加成
- [x] v3.6.2 开局福利（boon）3 选 1：PactScreen→BoonScreen→Game 流程；7 个 boon（充裕预算/能量预热/加固防线/誓约觉醒/命运牵引/黑市渠道/初遇眷顾）；按 rarity 加权抽取；可跳过；本局生效（不影响 meta 持久数据）
- [x] v3.6.3 升级树重置返还 + 分类标签：MetaUpgrade 新增 tag 字段（经济/盟约/事件/防御）；MetaScreen 顶部分类筛选 chip；重置按钮改为返还 80% 已花费碎片（resetMetaWithRefund）；重置前 confirm 显示返还数额
- [x] v3.7.0 成就 / 解锁系统：MetaSave 扩 stats（累计开局/通关/波数/史诗/单局共鸣峰值/枷锁通关/已用 boon 集合）+ achievements 持久层；新增 8 个成就（首胜/沙场老将/百战之躯/深渊探求/共鸣大师/枷锁勇者/福利收藏家/不屈意志），命中即弹窗发放碎片奖励；GameEngine 在每波/通关/失败/事件解析时联动统计；主菜单新增「🏆 成就」入口（AchievementScreen 含进度条与统计摘要）
- [x] v3.8.0 每日挑战：基于日期种子（mulberry32）固定 3 盟约（含 1 枷锁），主菜单「📅 每日挑战」入口；MetaSave 加 daily.lastCompletedDate；GameEngine 加 isDailyMode，通关时若当日未结算则 +150 碎片奖励；DailyScreen 显示今日盟约/状态/奖励
- [x] v3.9.0 BGM/SFX 接入：WebAudio 合成骨架（无外部资源），8 个 SFX（部署/射击/受击/波清/失败/点击/事件/成就）+ 3 路混音器（master/sfx/bgm）；主菜单「⚙ 设置」入口含音量滑块 + 试音按钮；BGM 在开战时启动、设置面板可单独试听；GameEngine 在部署/受击/波次清理/事件/成就解锁等节点联动播音

## v4.x — 联机

- [x] v4.0.0 联机骨架：Node.js + ws WebSocket 服务端（server/index.js, port 8787，房间/聊天/准备/start 协议）；WsAdapter 浏览器客户端（连接/创建/加入/离开/准备/聊天 + 事件总线）；MultiplayerScreen 重写为完整大厅 UI（连接 / 房间列表 / 创建房间 / 房间内准备 / 实时聊天）；`npm run mp-server` 启动后端
- [x] v4.0.1 联机本地联调：服务端补发已存在对端列表给加入者（修复 B 看不到 A 的 bug）；新增 docs/MULTIPLAYER.md 启动指南/协议表/故障排查
- [x] v4.1.0 帧同步骨架（只读镜像）：GameEngine.getStateSnapshot() 序列化最小状态（敌人/干员/子弹/HP/资源/波次），host 在 onStateUpdated 节流 ~120ms 通过 ws sendGame 广播；guest 在 start 信号后进入 MultiplayerGuestViewer 只读镜像视图（canvas 简化绘制）；服务端新增 game 类型转发；joined 增加 role 字段区分 host/guest
- [x] v4.1.1 联机体验打磨：start 信号后 host 自动跳主菜单 + 提示开始游戏；GameScreen 顶部 host 直播横幅显示对端昵称；MultiplayerScreen 房间面板展示双方准备 ✓ 标记 + 角色标签 [主机]/[观战]；guest 观战视图显示 host 昵称 + 对端离开/断线提示
- [x] v4.2.0 guest 反向标记点：guest 在观战画布点击发出📍标记（含发起者名/可选标签），通过 ws marker 类型广播；host 主画面叠加显示 5 秒后渐隐；guest 自身视图同样显示自己的标记。新增 src/network/mpMarkers.ts 共享模块（installMarkerListener/pushLocalMarker/drawMarkers）
- [x] v4.2.1 预设指令表情：guest 观战面板新增 6 个快捷按钮（⚠ 危险 / 🛡 备战 / 💰 金钱不足 / 👹 Boss / 🏃 撤退 / 🤝 支援），点击使用最近鼠标位置发送带 label 的 marker；canvas mousemove 跟踪坐标兜底居中
- [x] v4.2.2 host→guest 事件 toast 推送：服务端新增 event 类型转发；WsAdapter.sendEvent(kind,text,level)；host 在波次开始/进入备战/生命≤3/失败 节点自动 sendEvent；guest 观战界面右上角弹出彩色 toast（info/warn/success/danger），3.5s 后自动淡出
- [x] v4.2.3 guest 部署提议：guest 观战面板新增「🎯 提议部署」toggle，开启后下次点击解析为格坐标，sendEvent(kind=deploy_request)；host 顶部弹出提示条 + 接受/拒绝按钮，10s 自动关闭；选择后通过 deploy_response 事件回送 toast 给 guest
- [x] v4.2.4 联机音效反馈：复用 v3.9.0 SFX 系统，guest 点击画布/按钮播 click，发部署提议播 event；host 收到 marker 播 click、收到 deploy_request 播 event、接受播 wave_clear、拒绝播 click；guest 端 event toast 按 level 联动音效（danger/warn→event, success→wave_clear, info→click）
- [ ] 状态同步策略：增量帧 + 操作包
- [ ] 双人共享地图、独立资源 / 独立队列
- [ ] 断线重连 + 延迟补偿

## v5.x — 内容扩充

- [ ] 全 8 大职业及子职业
- [ ] 30+ 干员（含星级 1-6）
- [ ] 20+ 敌人（普通 / 精英 / Boss）
- [ ] 关卡章节制 + 地图机关（投石机 / 传送门 / 毒云）

---

## 实施约束

- 每个 v 升级都对应一个 commit，格式 `vX.Y.Z 中文描述`
- 中版本递增（X.Y → X.Y+1）需做分支整理（参考用户全局 git 工作流偏好）
- 数据扩展优先于新机制：先把「能配置出明日方舟原版数据」的能力建好
