# Personal Space

基于 Astro、TypeScript 和 Markdown/MDX 的个人数字空间。提供 Compass 首页、共享 Spotlight，以及 Me、Think、Build、Keep 四个独立公开模块。Phase 2 已接入用户提供的真实内容；实施与验收状态见 PLAN.md。

## 文档与执行范围

- [NEED.md](./NEED.md)：产品需求与目标架构来源。
- [PLAN.md](./PLAN.md)：Phase、milestone、验收和实施状态的 source of truth。
- [DESIGN.md](./DESIGN.md)：已批准的统一材质、各模块布局与交互设计；实施状态仍见 PLAN.md。
- [AGENTS.md](./AGENTS.md)：Codex 工作约束。
- [docs/architecture.md](./docs/architecture.md)：架构边界和工程说明。
- [docs/content-guide.md](./docs/content-guide.md)：字段、公开条件、内容增删与维护示例。
- [docs/release-checklist.md](./docs/release-checklist.md)：Phase 3支持矩阵、验证证据与发布/真机验收操作。

按用户授权逐个实施和验收 milestone；每项通过后更新 PLAN.md。当前用户已授权Phase 3，逐项验证，完成阶段后暂停验收；手机真机检查集中到上线后。

## 环境

使用 Node.js 22 LTS；初始基线在 Node 22.23.2、npm 10.9.8 上验证，后续 Phase 1 检查使用 Node 24.19.0、npm 10.9.8。基线版本记录在 .node-version，其他允许的范围见 package.json 的 engines。

依赖使用精确版本及 package-lock.json 固定。TypeScript 使用 6.0.3，因为当前 @astrojs/check 和 typescript-eslint 尚不支持 TypeScript 7；不要单独升级到不兼容版本。

## 安装与启动

在项目根目录执行：

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4321
```

打开 http://127.0.0.1:4321/。按 Ctrl+C 停止服务。

Windows PowerShell 中可使用 npm.cmd 代替 npm，npx.cmd 代替 npx。

## 检查与生产预览

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview -- --host 127.0.0.1 --port 4322
```

打开 http://127.0.0.1:4322/。构建产物位于 dist/；preview 需要先成功执行 build。

| 命令 | 用途 |
| --- | --- |
| npm run dev | 启动开发服务 |
| npm run lint | 检查 JavaScript、TypeScript 和 Astro；警告也会使检查失败，不自动改写文件 |
| npm run typecheck | 使用 astro check 检查 TypeScript 和 Astro |
| npm run test | Node 单元测试：注册、路由、搜索、统计与 Compass 几何 |
| npm run build | 生成静态站点；此命令不代替独立的类型检查 |
| npm run preview | 本地预览生产产物，不是线上部署 |

浏览器回归使用独立 Chromium，并自动启动仅绑定本机的生产产物测试服务；先构建：

```sh
npx playwright install chromium
npm run build
npm run test:e2e
npm run test:extension
node tests/verify-content.mjs
node tests/verify-design.mjs
```

test:e2e 检查 Spotlight、焦点、网络重试、输入法、明暗主题、减少动态效果、模糊降级、导航与公开产物。默认使用 4410 端口，不复用已有服务。test:extension 在 .cache 中复制工程并仅新增一个测试模块，检查类型和构建、五边形、数量、搜索与路由；正式 src/modules 仍为四模块。失败时查看 test-results/ 中的截图和 trace，不跳过失败用例。

verify-content.mjs 在隔离副本中验证新增 Markdown、取消公开、空集合和删除后的列表/详情/数量/搜索，检查原始 src 哈希不变。产物仍在 .cache；可使用以下环境选择对应浏览器探针：

```powershell
$env:E2E_DIST = Get-Content .cache/content-output.txt
$env:E2E_BASE_PATH = '/personal-space/'
$env:E2E_CONTENT_PROBE = '1'
npm.cmd run test:e2e
Remove-Item Env:E2E_DIST, Env:E2E_BASE_PATH, Env:E2E_CONTENT_PROBE

$env:E2E_DIST = Get-Content .cache/content-empty-output.txt
$env:E2E_BASE_PATH = '/personal-space/'
$env:E2E_EMPTY_PROBE = '1'
npm.cmd run test:e2e
Remove-Item Env:E2E_DIST, Env:E2E_BASE_PATH, Env:E2E_EMPTY_PROBE
```

verify-design.mjs 在隔离副本生成多分类收藏、文章/随记和含阶段/更新/问题的项目，仅用于测试，不修改真实资料。设置 E2E_DIST 为 .cache/design-probe-output.txt 的内容、E2E_BASE_PATH=/personal-space/、E2E_DESIGN_PROBE=1 后运行 test:e2e，检查对应浏览器用例；运行后清除这些进程环境变量。

若受限 Windows 环境的自动测试服务退出超时，可在一个终端运行 `node tests/serve.mjs`（相同 E2E_PORT/E2E_DIST/E2E_BASE_PATH），另一个终端设置 E2E_EXTERNAL_SERVER=1 再运行 `npm run test:e2e`。这仅由外部管理服务器生命周期，全部测试断言保留；结束时 Ctrl+C 关闭服务并清除变量。正常环境使用默认自动服务器。

子路径验证（PowerShell 示例）：

```powershell
npm.cmd run build -- --base /personal-space/ --outDir .cache/base-dist
$env:E2E_DIST = '.cache/base-dist'
$env:E2E_BASE_PATH = '/personal-space/'
npm.cmd run test:e2e
Remove-Item Env:E2E_DIST, Env:E2E_BASE_PATH
```

隔离扩展构建的浏览器验证（先执行 test:extension）：

```powershell
$env:E2E_DIST = Get-Content .cache/extension-output.txt
$env:E2E_EXTENSION = '1'
npm.cmd run test:e2e
Remove-Item Env:E2E_DIST, Env:E2E_EXTENSION
```

手动验收可从 Compass 进入四模块，Hover 或 Tab 聚焦查看数量；点击放大镜或在非编辑状态按 Ctrl/Cmd + K 打开搜索。空查询是模块入口，输入英文或中文查找公开内容，上下键选择、Enter 打开、Esc 或遮罩关闭。可尝试“韩江恺”“底层”“NEMU”“工具”或“Missing Semester”。模块页的 HJK 返回首页。Keep 搜索进入本站详情，详情的“打开来源”访问课程网站。刷新、焦点恢复和控制台错误也需要检查。

## 发布准备与版本保留

当前正式目标是用户指定的 https://hjk202.github.io/，对应现有public仓库hjk202/hjk202.github.io，根路径部署。`astro.config.mjs`统一读取`SITE_URL`和`BASE_PATH`，默认使用该地址与`/`；本地预览也输出正式canonical。项目站点测试仍用`--base /personal-space/`，不能把测试前缀用于这个根站点。

`.github/workflows/deploy.yml`在push/PR检查，在main手动`workflow_dispatch`时才发布。Node来自`.node-version`，npm固定10.9.8，依赖用npm ci。lint/typecheck/unit/build、Chromium根/子路径和WebKit移动检查通过后，上传原先已测试的dist；部署任务不重新构建。不添加长期令牌或把环境文件提交仓库。

本地`v0`标签指向用户认可的Phase 3前版本（ad0e0af）。查看用`git show v0`，在隔离目录复现旧版本；不要用reset --hard或强制推送覆盖当前工作。发布流程、实际源版本/产物哈希、线上验收与回退说明见[发布清单](./docs/release-checklist.md)。正式推送、Pages配置及首发只在3.7执行。

## 当前文件结构

```text
src/pages/index.astro    Compass 首页
src/pages/[...path].astro 通用模块路由桥
src/pages/search-index.json.ts 公开搜索快照
src/pages/404.astro      真实错误页与Home/Spotlight返回
public/favicon.svg      静态Compass符号
src/core/module/         契约、构建 Registry、页面校验、地址处理
src/core/search/         构建投影与浏览器纯匹配
src/shell/               Shell、Compass、Spotlight、主题与玻璃样式
src/modules/            think / build / me / keep，各自的数据与页面
tests/                  单元、浏览器与隔离扩展验收
astro.config.mjs        静态输出和 MDX 集成
tsconfig.json           Astro strict 配置
eslint.config.mjs       JavaScript / TypeScript / Astro lint
docs/architecture.md    架构边界
```

Think 使用模块内 Markdown，其他模块使用各自 TypeScript 数据与最小校验。首批公开内容为韩江恺的介绍、一篇学习思考文章、NEMU 项目与 Missing Semester 收藏；默认四模块数量均为 1，三个内容详情页和四个模块首页共形成 8 个正常 HTML 页面（含首页），另有404错误页，共9页；错误页不计入内容。此前六份 Demo 已移除。移动模拟回归已补齐，真机检查与线上发布仍待完成；没有Private。

新增模块只增加 src/modules/<id>/：module.ts 默认导出最小 Module 契约，pages.ts 默认导出页面描述数组（空 path 为模块首页），其余数据与页面由模块管理。目录名与 id 一致，route 为无 base 的逻辑地址，order 唯一，enabled 默认 true。共享层通过固定 glob 自动发现，不维护中心模块列表；统计和搜索目标必须对应实际公开内容与已生成页面。详细边界见 docs/architecture.md。

node_modules/、.astro/、dist/、.cache/、test-results/ 和 playwright-report/ 是依赖或生成目录，已加入 .gitignore。不要手改构建产物；内容与代码变更后重新检查并构建。
