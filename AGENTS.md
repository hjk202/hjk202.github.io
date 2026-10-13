# Codex 工作约束

本文件适用于本项目内的所有 Codex 工作。目标是按已批准路线逐个完成 milestone，保持改动小、代码简单、验证真实。

## 1. 文档权责

- `NEED.md` 是产品需求与目标架构的来源。
- `PLAN.md` 是实施路线、Phase 划分、milestone 范围、Done Criteria、Verification 和实施状态的 source of truth。
- `AGENTS.md` 只约束执行方式，不能成为新增产品需求或扩大范围的依据。
- 用户明确的新指令优先于旧约定；需要同步需求或计划时，只修改已获授权的内容。
- 不得通过先改 NEED.md、PLAN.md 或 AGENTS.md，为未经授权的实现制造依据。

## 2. 一次只执行一个指定 milestone

- 仅执行用户当前明确指定的一个 milestone。
- PLAN.md 中的阶段顺序、依赖、下一候选项和 Pending 状态不构成执行授权。
- 如果任务要求实施但没有明确当前 milestone，先说明缺失并请求指定；可继续相关只读检查，不自行选择或开始实现。
- 开始前确认前置依赖已经完成。依赖缺失时报告问题，不顺便实现前置或后续 milestone。
- 当前 milestone 的 Scope 和 Non-goals 是硬边界。不得擅自扩大范围或实现未来 Phase 功能。
- 完成并验证当前 milestone 后更新 PLAN.md，随后停止，不自动进入下一项。
- 若用户要求批量跨 milestone 工作，先将其拆为一个个独立执行与验收单元，明确新的授权方式，不将它解释为可以无边界扩展。

## 3. 修改前先阅读

每次任务开始时：

1. 阅读 NEED.md、PLAN.md、AGENTS.md；有适用的子目录工作规则时一并阅读。
2. 确认当前任务类型、授权范围和 milestone 的状态、依赖、Scope、Done Criteria、Verification。
3. 阅读要修改的源码、调用方、相关配置、测试和已有文档；不要仅凭文件名或旧上下文修改。
4. 核对工作区已有改动。存在 Git 时查看状态和相关差异；没有 Git 时根据文件清单和实际内容检查。
5. 用简短更新说明本次目标、预期文件范围和验证方式。

保护用户已有工作，不覆盖、回滚或清理无关改动。

## 4. 优先最小改动

- 只修改完成当前 milestone 所需的文件和行为。
- 不允许因“顺便优化”进行无关重构、重命名、格式化、依赖升级或页面改版。
- 不批量格式化项目，不为当前任务添加不必要的工具、库或数据系统。
- 保持代码简单，不为未知未来需求增加通用框架、额外层级、配置系统或占位实现。
- 测试应验证真实契约、用户行为或重要边界；不添加空测试、仅复述实现的断言或只为通过检查的代码。
- 如果必要修复超出当前范围，先解释影响并提出最小调整建议，等待用户对范围的明确决定。

## 5. 必须保持的架构边界

- 正常浏览保持 `Home → Module → Content`；快速查找通过 Spotlight。
- 全局导航仅 Compass、Spotlight 与允许的 Home link；不增加 Dock、Navbar 或 Sidebar。
- 首页只承担入口职责，不增加 Feed、About Section、Recent Activity、项目卡片或 Dashboard。
- Compass 根据 ModuleRegistry 动态生成 N 边形；数量来自真实的 Module.count()，不虚构统计。
- Spotlight 的模块入口和搜索来源由 Registry 自动接入；功能仅搜索和打开模块/内容，不扩展成命令系统。
- 模块彼此独立，不互相 import；跨模块引用使用普通 URL。
- 不建立 Relations、Activity、聚合 Timeline、知识图谱、统一 Content 图或 UniversalContent。
- Core 只承担 Registry、Search、Shared Types，以及后续获准的 Vault State。模块内部模型由模块管理。
- 遵守 PLAN.md 的构建期与浏览器边界；浏览器不能导入文件读取、内容编译、构建 Registry 或模块内部加载器。
- 新模块通过约定式注册接入，不给 Home、Compass、Spotlight 或 Core 增加模块专属逻辑。
- Phase 1 不实现 Private、中心长按解锁、模块复杂功能、完整移动端适配或非必要数据系统。

## 6. 每个 milestone 的验证门槛

完成实现后，必须执行 PLAN.md 中该 milestone 的全部 Verification，以及以下公共检查：

| 检查 | 执行要求 |
| --- | --- |
| lint | 必须执行 |
| typecheck | 项目具备时必须执行；本项目 TypeScript 检查在 1.1 建立后持续执行 |
| test | 项目具备可运行测试时必须执行，不跳过已有测试 |
| build | 必须执行生产构建 |
| 页面 smoke test | 对受影响页面、入口、路由和交互执行必要验证 |

先读取 package.json 和测试配置，使用实际项目命令。PLAN.md 的默认命令为 npm run lint、npm run typecheck、npm run test、npm run build；已有浏览器自动化后运行相关 npm run test:e2e。

验证要求：

- 页面或交互变化不能只靠类型检查和 build 宣称可用；必须实际检查必要的浏览器行为。
- 根据当前 milestone 验证 Home link、Compass、Spotlight、搜索目标、焦点、键盘和部署 base 等受影响路径。
- 记录执行的命令、退出结果和页面 smoke test 证据；未运行的项目如实说明原因。
- 没有可运行测试时标记“不适用”，不能标记“通过”。不得删除测试、弱化规则或吞掉失败来制造成功结果。
- lint/build 是必需门槛。缺少命令或配置时，在已授权的工程初始化范围内建立；其他情况下先报告阻塞，不静默跳过或扩大范围。
- 工具不可用或页面无法验证时，明确记录限制；未满足必要验证时不能将 milestone 标为 Done。

## 7. 验证失败与计划冲突

验证失败必须先处理，不能直接进入下一 milestone：

1. 定位并说明失败原因及其与当前改动的关系。
2. 在当前范围内做最小修复，并重新运行相关检查及公共门槛。
3. 超出范围或无法自行解决时，将当前 milestone 标为 Blocked，记录原因与建议。
4. 不把失败、既有未解决问题或无法执行的必要验证当作通过。

如果发现 PLAN.md 与实际代码冲突：

1. 先指出具体文档条目、相关文件和实际行为。
2. 区分尚未实现、实现错误、计划过时和真实设计冲突。
3. 说明影响，并提出保持原架构的最小建议。
4. 在结论明确前不执行依赖该争议的改动；可以继续不受影响的只读检查或当前范围内工作。
5. 不擅自重新设计项目，不通过扩大当前 milestone 或改写计划绕过冲突；需要范围或设计变更时等待用户决定。

## 8. 更新 PLAN.md 与完成报告

- 用户指定并开始执行时，将对应 milestone 标为 In Progress，更新当前执行状态；同时最多一个 milestone 处于 In Progress。
- 遇到阻塞时将其标为 Blocked，并记录具体原因。
- 全部 Done Criteria 和 Verification 满足后，勾选对应完成项、标为 Done 并补充 Completion Record。
- 完成记录至少包含日期、简要变更、验证命令与结果、页面 smoke test 结果和仍存在的限制。
- 同步状态总览与当前执行状态；一个 Phase 的全部必需 milestone 完成后，才可更新该 Phase 为完成。
- 只更新当前 milestone 和必要的汇总状态，不擅自改动后续范围、验收标准或状态。
- 收尾报告简要说明完成的 milestone、修改内容、验证结果和限制，然后停止；下一 milestone 需要新的明确指定。

## 9. 文档任务与当前授权

仅整理规划或工作规则的任务，不等于实施 milestone。此类任务只修改用户指定的文档，并验证文档结构、交叉引用、要求覆盖和状态一致性；不要为了跑工程命令而创建项目代码或配置。

本文件初次创建时，授权范围仅为 PLAN.md 与 AGENTS.md。NEED.md 保持为需求来源；所有实施 milestone 仍为 Pending，当前没有被指定的实现 milestone。文档交付完成后停止。

未来任务以用户的新指令和 PLAN.md 当前执行状态为准，不将本段初始状态误读为永久禁止获准的后续开发。
