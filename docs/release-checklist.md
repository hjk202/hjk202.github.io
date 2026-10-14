# Phase 3 发布与验收清单

实施范围、依赖、状态和完成标准以 [PLAN.md](../PLAN.md) 为准。本清单只记录操作与证据，不授权进入下一 milestone。

## 当前基线

- 保存日期：2026-10-13；本地 Git 提交 `ad0e0af`，标签 `v0`。标签保存 Phase 3 实施前用户认可的源码、真实素材、设计和规划，不包含依赖或生成目录。
- 环境：Node 22.23.2、npm 10.9.8，与 `.node-version` / `packageManager` 一致。
- 页面：Home、Think/Build/Me/Keep 首页及三份详情，共8个HTML；四模块公开数量分别为1；Me Compass平均值为1。
- 素材：个人简介、从底层理解的文章、NEMU项目、Missing Semester收藏；不改原文，不补造项目历史。
- 视觉：维持已认可的玻璃材质和四模块特点，不重新设计。
- 发布授权：用户允许新站覆盖 https://hjk202.github.io/ 的旧demo。对应GitHub仓库、分支和Pages设置仍须只读核实；不强制推送或删除远程历史。
- 手机：OPPO Find X7 Ultra，默认浏览器；系统/浏览器版本尚未提供。按用户确认，上线后在3.8集中做真机基础验收。

## 支持与验证矩阵

| 场景 | 验证方式 | 验收要点 |
| --- | --- | --- |
| 320/360px窄屏、375/390px代表手机、430px大屏 | Chromium自动化与截图 | 内容看得清、无整页横向溢出、入口点得准 |
| 667×375短横屏、768px平板及实际断点两侧 | 重点模拟 | 可合理纵向滚动，不能为单屏把内容缩得不可用 |
| 1280/1440px桌面 | 现有回归与截图 | 保护当前设计、键盘、返回状态 |
| WebKit代表移动路径 | 浏览器重点回归 | 布局、dialog开合、结果滚动、跳转 |
| 明暗、减少动态、模糊降级 | 现有用例加必要smoke | 可读、可用，无动画或玻璃依赖的功能失败 |
| 根路径、模拟/personal-space/、实际发布路径 | 构建与请求/浏览器检查 | 页面、资源、搜索索引、Home和深层刷新 |
| OPPO默认浏览器真机 | 上线后用户执行，下表记录 | 看得清、点得准、键盘不遮住必要操作；不做复杂设备适配 |

模拟测试不等于真实系统键盘测试。未覆盖的平台如实列出，不宣称所有设备兼容。

## 公共检查

逐个milestone运行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 与相关 `npm run test:e2e`；失败先定位、修复、复验。Windows可使用 `npm.cmd`。以实际package.json为准，不跳过已有断言。

生产浏览器测试使用 `tests/serve.mjs`。需要 `E2E_EXTERNAL_SERVER=1` 时，先启动并确认服务就绪，测试后关闭；正常CI用默认服务生命周期。根/子路径产物保持独立。

| Milestone | 公共门槛 | 重点证据 | 状态 |
| --- | --- | --- | --- |
| 3.1 | lint/typecheck/23单元/build/23e2e全部退出0 | .cache/3.1-e2e.log；3.1-home-1440/375/320/667.png；3.1-mobile-baseline.json | Done |
| 3.2 | lint/typecheck/23单元/根与子路径build；各32e2e；WebKit9e2e；4–7节点两引擎8组合均通过 | .cache/3.2-*.log；mobile-probe-output.txt所指截图/测量 | Done |
| 3.3 | lint/typecheck/23单元/build；根与子路径各35e2e；WebKit12专项通过 | .cache/3.3-*.log；短高度/旋转/IME事件/40结果/还焦滚动；真机未测 | Done |
| 3.4 | lint/typecheck/23单元/build；根与子路径各38e2e；WebKit15；设计两引擎各5；内容/空各1通过 | .cache/3.4-*.log；320px真实页面与长分类截图；200%字号压力探针 | Done |
| 3.5 | lint/typecheck/24单元/9页build；根与真实site子路径各40e2e；WebKit head2；第五模块检查+1e2e通过 | .cache/3.5-*.log；真实404/默认与内容head/favicon；root正式site待3.6配置 | Done |
| 3.6 | 干净npm ci/lint/typecheck/24unit/build；根/base各40e2e；干净40/15；隔离契约与资产哈希通过 | 候选2991080；15文件manifest一致；.cache/3.6-*.log与performance.json | Done |
| 3.7 | 本地公共门槛与40e2e、真实云端全链路与线上smoke通过 | d3ccc76；run38496826924成功；15线上文件哈希相同、8页面/真实404/搜索/返回通过 | Done |
| 3.8 | 正在执行 | OPPO基础验收、真实内容更新部署、维护流程 | In Progress |

## 真机基础验收（上线后）

记录手机型号、系统版本、默认浏览器名称/版本、访问URL和日期。不必测试全部尺寸组合。

1. 竖屏打开Home，四个模块名清楚，逐个单次点入并返回，无旧选中高亮。
2. 打开搜索，输入“底层”或“NEMU”，键盘出现后能看到输入、关闭和结果，点结果可进入内容。
3. 点击遮罩/关闭搜索，动画衔接正常；背景可继续滚动，重新打开可输入。
4. 横屏再返回竖屏，无整页横向溢出或操作被遮住。
5. Me简介、Think文章、Build项目、Keep收藏均可阅读；分类/外链/Home返回可用。

2026-10-13用户在OPPO Find X7 Ultra默认浏览器确认上述基础操作正常，但点击按钮会短暂闪现蓝色方块。系统/浏览器版本未提供，iOS真机未实测。3.8已做最小tap-highlight修复，保持键盘焦点与原有操作反馈；修复后的真机结果等待二次部署后确认，不用模拟结果替代手机反馈。

## 已知差异与待输入

- 3.1登记的head/favicon/404/Actions缺口已由3.5–3.7验证解决；当前zh-CN与正式内容元信息/资产可用。
- 3.1测得375px约27px、短横屏约14px节点命中问题已由3.2修复，移动回归最小约44.12px。
- GitHub账号hjk202的admin/push权限与Pages已认证核实，public/main保持，旧046d0ba历史和demo-before-phase3保留；3.7线上已覆盖旧demo。实际发布与证据见下文。
- 用户确认OPPO软键盘/基本导航/横竖屏可用；蓝色触摸闪块正在3.8修复后二次上线验收。未知系统/浏览器版本及其他真机平台不猜测。
- 用户同意的Me GitHub链接已在3.8加入，二次部署尚待完成；未改原文或上传测试内容。
- 第一版不要求OG海报，不购买域名、字体或服务，不实现Private、后端、新模块或复杂设备兼容。

## 发布管线与目标

正式目标为现有public仓库`hjk202/hjk202.github.io`的`main`，网址https://hjk202.github.io/，base为`/`。`SITE_URL`/`BASE_PATH`是配置输入，默认值在astro.config.mjs；模拟/personal-space/只在隔离产物中验证。旧demo远程历史须保留，不改变仓库可见性。

单一工作流`.github/workflows/deploy.yml`：push/PR只检查；main上的手动workflow_dispatch才上传已检查dist并部署。步骤为固定Node/npm→npm ci→lint/typecheck/unit→root build→真实root e2e/WebKit移动→隔离契约→独立base build/e2e→产物清单→上传→部署。部署不再build，artifact只包含dist。官方Action提交已于2026-10-13核实并固定；语法与本地验证不等于真实Actions通过。

3.8手机标签修复后，隔离契约步骤额外运行既有verify-mobile.mjs，验证4–7模块在两引擎下的长名称、44px命中、文字/玻璃碰撞与真实跳转；当前触发范围与发布权限保持。

Windows检查沿用npm.cmd，本地浏览器缓存可由PLAYWRIGHT_BROWSERS_PATH指定。CI使用ubuntu-24.04与默认自动测试服务，不设置E2E_EXTERNAL_SERVER，不吞服务退出问题。`node tests/verify-release.mjs`检查工作流边界和产物，写入.cache/release-manifest.json（源SHA/Node/各文件SHA256），不把该记录放入网站。

### 发布操作（3.7）

1. 核实真实GitHub登录与仓库/Pages权限；获取并标记旧demo版本，保留原始main历史。合并本地新历史时保留当前产品树，不强制推送。
2. 确认Pages源为GitHub Actions、地址为根站点；依实际设置完成必要修改，不更改可见性或域名。
3. 推送已通过检查的源版本和v0；main推送只运行检查。明确记录候选源SHA后手动运行工作流。
4. 记录实际run链接、源SHA、artifact和部署URL，线上检查8个正常页面/404、索引/资产、Home/搜索/分类返回与深层刷新。

### 内容更新（3.8与以后）

编辑模块自己的真实文件→公共检查与相关浏览器验证→提交并推送main→手动运行工作流→核对线上页面和搜索。文本/公开链接编辑不改变数量；新增或删除条目才改变模块count和Me平均。每次记录源SHA和run链接，不把同源重跑当作内容更新。

### 回退约定

保留v0本地基线、旧demo源版本和每次已验收的Phase 3发布源版本。v0/旧demo构建方式可能不同，它们不是自动可用的当前Actions发布候选。

优先以最近一个已验收的Phase 3源版本为恢复目标：在隔离目录复现其干净安装/构建和必要smoke；确认差异后用新的git revert提交撤销相关产品改动，检查后按正常main手动发布流程部署。先保护当前未提交工作，不用reset --hard、强制推送或在正常线上做无必要的回退演示。3.8至少复现首发版本并记录真实可用的回退目标。

3.8已验证首发标签phase3-first-release（d3ccc76）可恢复：在新目录clone该标签，执行npm ci、npm run build、node tests/verify-release.mjs；15文件与首发候选哈希相同，4项页面/公开脚本/head/真实404搜索smoke通过。实际恢复时先检查git status，确定需要撤销的产品提交，用git revert生成可审阅的新提交；核对执行状态文档、运行公共检查和相关smoke后正常push main并手动发布。单独检出旧标签再点击main发布不会恢复旧版本；部署源必须是经过验证的新main提交。v0/旧demo也已远程保留，但不是当前发布管线的直接回退候选。

## 发布与维护记录

3.8的二次发布38499117547已成功部署810fb2c（用户批准的Me GitHub链接与触摸闪块修复），15线上文件与受验产物相同，搜索快照与首发相同、四模块各1/4目标/Me平均1。随后用户报告手机横向标签重合；本地已修复并通过公共/根与base各40/WebKit15/4–7两引擎8组合。文字中心保持对称，375px两侧文字与玻璃顶点间距约18–23px。第三次发布与最终OPPO确认仍待完成，不能以二次线上成功提前结束3.8。

2026-10-13首发已完成：认证账号hjk202，保留public/main与域名、从legacy切为workflow；正常推送保留旧demo历史，远程v0与demo-before-phase3已确认。源d3ccc76a6b6e292aef5e24ed036d41ae6561545c；[运行38496826924](https://github.com/hjk202/hjk202.github.io/actions/runs/38496826924)check/deploy均success，github-pages产物11864278192，digest sha256:5078a7da8e8b02d956d202213513607cb326960f58bf25c2be9cc59afc6f8435。线上15文件哈希与受验产物相同，8正常页面、索引/资源、正式head、搜索/返回及真实404通过，无页面异常。首发回退源为phase3-first-release；3.8将复现并执行获准的Me链接更新。以下段落保留3.6/发布前的历史记录，不代表当前阻塞。

3.6已通过本地与干净候选检查：产品候选2991080，15文件清单在.cache/release-manifest.json与release-candidate/.cache/release-manifest.json，完全一致。3.7取回旧046d0ba并作为9c974dc的祖先保留；两份本地备份标签已建立。当前缺少已认证GitHub账户，设备登录等待用户完成；不要把这一阻塞误读成重新请求发布许可。尚未推送、修改Pages或部署；真实Actions与线上结果留3.7/3.8。必要的文档完成记录会形成后续提交，但不改变已验证的产品/构建输入；线上工作流仍重新检查它实际部署的提交和同一dist。
