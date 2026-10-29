# 移动端与自适应布局

当前布局以横向战场为主。小屏竖持时，[LayoutManager](../src/core/LayoutManager.ts) 根据视口与设备信息为根节点添加 `mobile-rotated`，页面整体旋转 90°；横持和桌面视口无需旋转。屏幕切换仍由 [`showOnly`](../src/screens/shared.ts) 控制，隐藏的页面不会因旋转而重新显示。

对局按顶部状态栏、可伸缩战场、备战区和采购区纵向排列。屏幕高度不足时由弹性布局收缩战场，商店横向滚动；装备整备区保留独立操作。没有整页缩放，因此顶部和商店不会因缩放偏移到屏幕之外。具体样式见 [`protocol-theme.css`](../src/styles/protocol-theme.css) 和 [`index.html`](../index.html)。

Canvas 使用地图格子的逻辑尺寸；组合战场会按实际列数加宽。浏览器按容器等比例显示画布，鼠标及触摸坐标通过画布显示尺寸换算回逻辑坐标，相关实现见 [`Renderer.ts`](../src/view/Renderer.ts) 和 [`GameScreen.ts`](../src/screens/GameScreen.ts)。观战页面同样根据快照中的地图尺寸绘制。

本轮检查过桌面 1280×720、模拟横屏 800×450 和模拟竖屏 390×844 的显示范围及页面切换；这是浏览器设备尺寸模拟，不能代替真实手机和不同浏览器的完整测试。小屏字体和触摸体验仍需要在实际设备上持续验证。
