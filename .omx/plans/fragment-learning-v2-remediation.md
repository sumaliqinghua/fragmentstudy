# Fragment Learning v2 整改规划

实施依据：原工作区 `.omx/plans/fragment-learning-v2-remediation.md`。

## 产品契约

- 不同学习项目绝不自动混学；相关材料仅在用户确认后加入同一项目。
- 一个 Session 只属于一个项目和一种模式，模式只在 Session 边界切换。
- 卡片、群聊、Galgame 是一等体验，共享统一 Fragment 和素材引用。
- Exposure 只表示接触，不表示掌握；允许跳过、随时停止、不制造复习欠债。
- 项目地图用于方向感，不锁关、不强制顺序。

## 执行阶段

1. 建立测试、类型检查、lint 基线与 v2 领域契约。
2. 重建 Project、Material、ProjectMaterial、Section、Fragment、GenerationJob 数据层。
3. 落地 Import → Processing → 2–5 分钟 Card Session → 退出/续上。
4. 将群聊与 Galgame 接入统一 Session/Experience 合约。
5. 建立非锁关项目地图、可选挑战和低压力回归。

## 关键验收

- 未经确认的材料不会跨项目进入 Session。
- Session 创建后 project 与 mode 不可变。
- 三种模式共享 Fragment，但分别保存叙事游标。
- 首页一次点击恢复最近 Session，任意位置均可正常结束并续上。
- AI 知识内容可追溯到原始材料，生成任务幂等且可重试。
- build、typecheck、lint、测试与核心浏览器流程通过。
