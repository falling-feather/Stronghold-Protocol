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

## v4.x — 联机

- [ ] WebSocket 服务端（Node.js + ws）
- [ ] 房间系统（创建 / 加入 / 准备）
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
