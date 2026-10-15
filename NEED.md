# Personal Space v0.2

## 1. 项目最终定位

这个网站不是传统博客，也不是信息 Dashboard，更不是一个复杂的个人知识图谱。

它是一个非常简单的个人数字空间：

```text
                 HOME
                   │
             ┌─────┴─────┐
             │           │
          Compass    Spotlight
             │           │
             ▼           ▼
           Module      Search
             │
             ▼
          Content
```

整个网站只有两套核心导航逻辑：

### 纵向

```text
Home
 ↓
Module
 ↓
Module Content
```

用于正常浏览。

### 横向

```text
Spotlight
 ↓
Search / Jump
 ↓
Any Module / Any Content
```

用于快速跳转。

除此之外，不建立第三套导航体系。

---

# 2. 明确取消的东西

不再设计：

```text
Dock
全局底部导航栏
模块关系图
Related Content 系统
跨模块 Relation
复杂 Timeline 聚合
知识图谱
模块互相引用机制
统一 Activity 系统
```

如果某篇文章需要链接到一个项目：

直接写普通链接。

例如：

```markdown
这个问题后来在 [Dynamic 3D Gaussians 项目](/build/dynamic-3d-gaussians/)
中继续研究。
```

足够。

系统不为此建立额外抽象。

---

# 3. 首页职责

首页不是：

```text
个人简历
内容 Feed
最近文章
最近项目
精选内容
```

首页就是整个网站的：

# Entrance

功能上只有两个东西：

```text
1. Compass
2. Spotlight
```

除此之外只能存在少量非交互性的身份信息，例如：

```text
HAN JIANGKAI

Personal Space
```

不能继续往首页塞：

```text
Latest Posts
Currently Reading
Projects
About Me
Recent Activity
```

首页必须保持极简。

---

# 4. 首页基本布局

桌面端大致结构：

```text
┌─────────────────────────────────────────────┐
│                                             │
│ HJK                                     🔍  │
│                                             │
│                                             │
│                                             │
│                  THINK                      │
│                    ●                        │
│                                             │
│             ●              ●                │
│            KEEP            BUILD            │
│                                             │
│                 ╱──────╲                    │
│               ╱    ╱╲   ╲                   │
│              │   ╱   ╲   │                  │
│               ╲ ╱─────╲ ╱                   │
│                 ╲─────╱                     │
│                                             │
│                    ●                        │
│                    ME                       │
│                                             │
│                                             │
│                                             │
│            Personal Space                   │
│                                             │
└─────────────────────────────────────────────┘
```

实际模块数量动态决定多边形。

四个模块就是四边形。

五个模块就是五边形。

七个模块就是七边形。

不存在固定位置写死。

---

# 5. Compass

Compass 是整个网站最重要的视觉对象。

但它并不是真正的指南针。

它由两部分组成：

```text
外部：
模块多边形

内部：
内容数量 Radar Polygon
```

类似游戏里的：

```text
能力雷达图
JOJO 替身面板
角色属性图
```

---

# 6. Compass 外层

假设当前启用：

```text
Me
Think
Build
Keep
Travel
Photography
```

共 6 个模块。

则自动生成一个正六边形。

每一个顶点对应一个 Module：

```text
                   THINK
                     ●

            KEEP             BUILD
             ●                 ●


            PHOTO            TRAVEL
             ●                 ●

                     ●
                     ME
```

模块顶点本身就是入口。

点击：

```text
THINK
```

进入：

```text
/think
```

点击：

```text
BUILD
```

进入：

```text
/build
```

没有第二级菜单。

---

# 7. Compass 内层

外部是模块位置。

内部有一个动态的不规则 N 边形。

例如：

```text
                 Think
                   ●
                  / \
                 /   \
          Keep ●       ● Build
               |\     /|
               | \___/ |
               | /   \ |
         Photo ●       ● Travel
                \     /
                 \   /
                   ●
                   Me
```

内部 Polygon 每一个方向的长度表示：

> 当前模块中的内容数量。

例如：

```text
Think        36
Build         8
Keep        124
Photography  18
Travel        7
Me            1
```

形成独属于当前网站状态的：

# Personal Radar

这个 Radar 本质上就是：

> 我的数字空间现在长什么样。

随着内容增加，它会不断变化。

---

# 8. Radar 数值不能直接使用原始数量

这里需要提前规定。

假设：

```text
Keep 500
Build 8
```

如果直接做线性映射：

Keep 会几乎拉到最外层。

Build 会缩在中心。

最后图形没有可读性。

因此视觉距离采用经过压缩的数量映射。

例如概念上：

```text
visualValue =
log(1 + count)
```

然后在当前模块之间归一化。

因此：

```text
实际数量
```

和：

```text
视觉半径
```

不是完全线性的。

但鼠标 Hover 时必须显示真实数字：

```text
THINK
36 entries
```

这样既保留统计意义，也保证图形美观。

---

# 9. Compass 不是数据分析图

不要把它做成：

```text
坐标轴
刻度
图例
复杂 Tooltip
大量数字
统计 Dashboard
```

它首先是：

> 一个入口。

其次才是：

> 一个统计可视化。

因此外观应该非常克制。

---

# 10. Compass 交互

默认：

```text
所有模块名低调显示
内部 Radar Polygon 可见
```

Hover 某一模块：

对应方向略微突出：

```text
顶点增亮
模块名增强
对应 Radar 顶点轻微放大
```

中央可以非常短暂地出现：

```text
THINK
36
```

点击进入模块。

---

# 11. Compass 中心

中心不要放菜单。

也不要放大段文字。

中心原则上保持空。

最多有一个极小的：

```text
◎
```

作为视觉中心。

这个位置可以承担 Private Entrance。

后面单独说明。

---

# 12. Compass 的视觉语言

Compass 本身不应该像传统 Chart.js 雷达图。

需要重新设计。

使用：

```text
极细边线
半透明层
柔和高光
Liquid Glass
轻微折射
低饱和色
```

外部模块骨架：

```text
非常淡
```

内部 Radar：

```text
稍微明显
```

Hover：

```text
局部 Liquid Glass 高光
```

整体应该更接近：

> 一个漂浮在桌面上的玻璃仪表。

而不是 Excel 雷达图。

---

# 13. 首页 Liquid Glass 的使用位置

Liquid Glass 主要用于两个地方：

```text
Compass
Spotlight
```

这样视觉语言非常集中。

首页其余部分：

```text
简单背景
极少文字
大量留白
```

因此玻璃效果不会泛滥。

---

# 14. Spotlight

第二个核心系统：

# Spotlight

它直接借鉴 macOS Spotlight 的交互逻辑。

但不是完全复制视觉。

首页右上角存在一个很小的：

```text
⌕
```

或者：

```text
🔍
```

实际应该设计成自己的 SVG Icon。

不要显眼。

---

# 15. Spotlight 打开

点击放大镜。

页面背景：

```text
轻微变暗
轻微 blur
```

中央偏上出现 Liquid Glass Panel：

```text
╭──────────────────────────────────────╮
│ 🔍  Search my space...              │
├──────────────────────────────────────┤
│                                      │
│          ○       ○       ○          │
│        Think    Build    Keep        │
│                                      │
│          ○       ○       ○          │
│        Photo    Travel    Me         │
│                                      │
╰──────────────────────────────────────╯
```

这基本就是：

> macOS Spotlight + App shortcuts

但下面的 App：

```text
Safari
Mail
Notes
```

替换成：

```text
Think
Build
Keep
Photography
Travel
Me
```

---

# 16. Spotlight 默认状态

还没有输入搜索内容的时候：

显示：

```text
Search Box

Modules
```

Module shortcut 根据 Module Registry 自动生成。

因此如果未来加入：

```text
Photography
```

Spotlight 自动多一个。

不修改 Spotlight 代码。

---

# 17. Spotlight 搜索状态

一旦开始输入：

模块快捷方式逐渐让位给搜索结果。

例如：

```text
Gaussian
```

出现：

```text
╭──────────────────────────────────────╮
│ 🔍 Gaussian                         │
├──────────────────────────────────────┤
│                                      │
│ THINK                                │
│ Understanding Gaussian Splatting     │
│                                      │
│ BUILD                                │
│ Dynamic 3D Gaussians                 │
│                                      │
│ KEEP                                 │
│ 3DGS Original Paper                  │
│                                      │
╰──────────────────────────────────────╯
```

只负责搜索。

不要把 Spotlight 做成：

```text
Command Palette
Terminal
Shell
复杂命令系统
```

最多支持：

```text
搜索
打开模块
打开内容
```

---

# 18. Spotlight 快捷键

支持：

```text
Cmd + K
Ctrl + K
```

也可以支持：

```text
/
```

但 `/` 是否启用可以后续决定。

ESC：

```text
关闭 Spotlight
```

方向键：

```text
选择结果
```

Enter：

```text
进入结果
```

这是唯一需要比较完整键盘操作的系统。

---

# 19. 两套导航的关系

Compass：

> Explore

Spotlight：

> Find

这是两者非常明确的分工。

```text
            HOME

      Compass      Spotlight

      Explore        Find
         │             │
         ▼             ▼
       Module       Anywhere
```

Compass 是：

> 我不知道我要看什么，先看看这个人的世界。

Spotlight 是：

> 我知道我要找什么，直接去。

---

# 20. 网站不再需要全局导航栏

明确规定：

# 不做 Dock。

# 不做 Navbar。

进入 Think 页面以后：

顶部最多只有：

```text
HJK
Think
⌕
```

例如：

```text
HJK / THINK                              ⌕
```

其中：

```text
HJK
```

点击返回首页。

```text
⌕
```

打开 Spotlight。

这已经足够完成全站导航。

---

# 21. 模块页面结构

所有 Module 页面共享一个非常简单的 Shell：

```text
HJK / MODULE                          ⌕

Module Title

Module 自己的内容
```

框架不关心：

```text
Think 怎么展示
Build 怎么展示
Keep 怎么展示
```

这是模块自己的事情。

---

# 22. 整个架构只有一条纵向链

最终必须保持：

```text
Shell
  │
  ▼
Module Interface
  │
  ▼
Module
  │
  ▼
Module Internal Interface
  │
  ▼
Content
```

不能再额外建立：

```text
Relations
Activity
Timeline Aggregator
Global Content Graph
```

---

# 23. Framework 与 Module 的接口

Framework 只需要知道：

```text
Module {
    id
    name
    route
    icon
    order

    count()
    search()
}
```

必要的话再加：

```text
enabled
description
```

不要继续把接口做大。

---

# 24. Module Interface 的真正职责

它只回答几个问题：

### 我叫什么？

```text
name
```

### 我在哪里？

```text
route
```

### 我在 Compass 哪个位置？

```text
order
```

### 我有多少内容？

```text
count()
```

### 我的内容怎么被找到？

```text
search()
```

### 我的图标是什么？

```text
icon
```

到这里就结束。

---

# 25. Module Registry

所有一级模块注册到：

```text
ModuleRegistry
```

例如：

```text
Me
Think
Build
Keep
```

以后：

```text
Photography
Travel
```

也只是注册。

Compass：

```text
读取 ModuleRegistry
```

Spotlight：

```text
读取 ModuleRegistry
```

其他地方无需知道新模块存在。

---

# 26. 新增 Module 的标准

例如增加 Photography。

只新增：

```text
modules/
    photography/
```

注册：

```text
PhotographyModule
```

然后自动得到：

```text
Compass 顶点
Radar 统计方向
Spotlight 模块入口
Spotlight 搜索能力
```

如果增加 Photography 需要去修改：

```text
Compass
Spotlight
Home
Core
```

说明架构失败。

---

# 27. 模块之间完全独立

明确禁止：

```text
Think import Build
Build import Keep
Travel import Photography
```

模块之间不通过框架建立关系。

如果真的需要关系：

直接使用 URL。

这是设计原则。

---

# 28. 模块内部接口

模块自己负责自己的扩展。

例如：

```text
Build
```

内部可以有：

```text
Project
Project Log
Milestone
Resource
```

但是这些属于：

```text
Build Module
```

Core 不知道它们存在。

---

# 29. Think 内部

Think 可以自行定义：

```text
Post
Essay
Note
Reflection
```

但外部 Framework 只看到：

```text
Think
```

以及：

```text
Think.count()
Think.search()
```

---

# 30. Build 内部

Build 可以定义：

```text
Project
Log
Milestone
Experiment
```

但外部只看到：

```text
Build
```

---

# 31. Keep 内部

Keep 可以定义：

```text
Bookmark
Paper
Tool
Website
Video
Book
```

甚至以后内部增加分类体系。

框架完全不需要修改。

---

# 32. 不强制统一所有 Content

这是一个非常重要的决定。

不做：

```text
UniversalContent
```

然后强行让：

```text
Post
Project
Bookmark
Photo
Trip
```

全部继承同一个巨大结构。

这样最终只会产生大量无意义字段。

应该是：

```text
Framework
   │
 Module API
   │
 Module
   │
自己的 Content Model
```

这才是真正的模块化。

---

# 33. 搜索接口是唯一横向接口

模块之间唯一共享的能力就是：

```text
Search
```

每个 Module 自己负责把内部内容转换成：

```text
SearchResult
```

例如统一：

```text
SearchResult {
    title
    description
    url
    module
}
```

就够了。

Spotlight 不需要知道：

```text
这个结果到底是 Post 还是 Project。
```

---

# 34. Count 接口

第二个唯一的跨模块统一能力是：

```text
count()
```

用于 Compass。

例如：

```text
Think.count()
→ 36

Build.count()
→ 8

Keep.count()
→ 124
```

Compass 只拿数字。

不关心里面是什么。

---

# 35. Homepage 与模块完全解耦

Home 只依赖：

```text
ModuleRegistry
```

然后：

```text
ModuleRegistry
       │
       ├── Compass
       │      ↓
       │    count()
       │
       └── Spotlight
              ↓
            search()
```

首页永远不写：

```text
getThinkPosts()
getProjects()
getBookmarks()
```

---

# 36. Private Layer

Private 仍然保留。

但不能引入新的架构层级。

Private 是：

```text
Access State
```

而不是：

```text
Private Module
```

---

# 37. Private Entrance

最适合现在这个 Compass 设计的入口：

# 长按 Compass 中心

正常状态：

```text
        ◎
```

普通点击：

什么都不发生。

长按大约：

```text
1.5s
```

长按过程中首页和 Radar 保持原状，不收缩、不淡出、不提示进度，不显示悬停文字。

达到时长后直接显示极简玻璃口令框；开启和关闭均无缩放、位移或遮罩动画。保留玻璃材质、清晰输入与键盘可访问性。

本条按2026-10-15用户验收反馈替代原先的Radar收缩、模块模糊和弹出动画。公开Spotlight仍沿用已验收的展开/收起动画。

按用户后续确认，口令保留正常字母、数字、Unicode、标点符号和空格；拒绝控制/不可见字符及超过1024 UTF-8字节的输入。界面与核心使用相同校验，不删除字符、截断、trim或偷偷规范化；新建/换口令仍至少16个字符。口令仅作为密码学数据，不作为HTML、脚本、查询或命令执行，字符限制不能替代防注入和密文保密。

---

# 38. 为什么选择中心

因为 Compass 中心本来没有普通功能。

因此隐藏入口不会和正常交互冲突。

语义上也成立：

```text
外面的顶点
→ 面向外界的我

中心
→ 更内在的内容
```

不需要任何 Terminal。

也不需要：

```text
sudo
secret
Konami Code
```

---

# 39. Private 内容

当前四个 Module 都支持各自的 Private 内容，由模块自行管理；一次解锁后在对应模块内显示。没有录入私人材料时不生成占位内容，也不集中到另一个私人页面。

例如：

```text
Think
public posts
private posts

Keep
public bookmarks
private bookmarks

Build
public logs
private logs

Me
public profile
private profile supplement
```

仍然是各自独立。

Core 只提供：

```text
isVaultUnlocked
```

模块自己根据它决定展示什么。

---

# 40. Private 与 Spotlight

解锁之前：

```text
Spotlight
→ public search
```

解锁之后：

```text
Spotlight
→ public + private search
```

仍然通过：

```text
Module.search()
```

实现。

Spotlight 不直接处理 Private Content。

---

# 41. 首页解锁后的变化

解锁后不要出现新 Dashboard。

Compass 仍然还是 Compass。

按2026-10-15已批准的[内室设计](docs/vault-visual-design.md)，成功解锁后采用独立于系统明暗的深墨环境、烟色液态玻璃与局部温光，表达隐蔽、安宁和内省；与公开深色主题有明确区别。锁定后恢复当时的系统主题，不保存私人主题偏好。

入口动作依然安静，不显示长按进度或解锁动画；主题仅在成功解密和校验后切换。Compass 保持原结构与真实统计，不增加首页私人预览、Feed 或 Dashboard，状态通过现有小标记和锁定按钮表达。

各模块的私人内容位于必要身份/标题之后、公开内容之前，按真实 DOM 顺序呈现。公开内容同页完整可达，双方都有清楚的可见性标记；详情仍专注当前内容。Me 为内在叙述，Think 为温暖夜间思想空间，Keep 为分区分类收藏柜，Build 为项目工作台与对应项目内的私人记录。私人补充不重复计为项目。

Spotlight 保持相关性排序并搜索全部可访问内容，在会话内存中根据实际命中来源显示公开/私人标记；不修改公开索引字段或持久化私人来源。锁定立即清理私人内容与来源，不使用私人画面快照或延迟淡出。视觉风格不改变既有加密、入口与会话安全边界。

---

# 42. 首页视觉结构最终定稿

最终首页大致就是：

```text
┌────────────────────────────────────────┐
│                                        │
│ HJK                                ⌕   │
│                                        │
│                                        │
│                                        │
│                 THINK                  │
│                   ●                    │
│                                        │
│          KEEP            BUILD         │
│            ●              ●            │
│              ╲          ╱              │
│               ╲  ╱──╲ ╱                │
│                ╲│ ◎  │                 │
│                ╱╲────╱╲                │
│               ╱        ╲               │
│             ●            ●              │
│           PHOTO        TRAVEL           │
│                                        │
│                   ●                    │
│                  ME                    │
│                                        │
│                                        │
│              Personal Space            │
│                                        │
└────────────────────────────────────────┘
```

没有：

```text
卡片
Feed
栏目
导航栏
按钮堆
```

---

# 43. 手机端

手机端仍然保持 Compass。

不要改成列表菜单。

N 边形等比缩放。

模块 Label 可以：

```text
围绕图形
```

如果屏幕太窄：

允许缩小字号。

Spotlight：

```text
右上角
```

点击后占据屏幕大约：

```text
90% 宽度
```

交互保持一致。

---

# 44. Liquid Glass 风格

全站只有少量真正需要 Glass 的区域：

```text
Compass
Spotlight
Private Unlock
少量 Button / Filter
```

内容页面仍然保持非常干净。

因此整体风格应该是：

# Quiet Liquid Glass

不是：

```text
所有东西都是玻璃卡片
```

---

# 45. 色彩

网站主背景：

Light：

```text
偏暖或中性的浅白
```

Dark：

```text
接近黑但不是纯黑
```

Compass 的不同方向可以使用非常轻的色彩差异。

但禁止：

```text
每个 Module 一个强烈主题色
```

Radar Polygon 可以有轻微：

```text
蓝紫 / cyan / spectral
```

Liquid Glass 高光。

---

# 46. 动画

Compass：

首次载入：

```text
外框轻微展开
Radar Polygon 从中心生长
```

控制在：

```text
500–800ms
```

Hover：

```text
150–250ms
```

Spotlight：

放大镜点击后：

```text
icon
 ↓ morph
glass search panel
```

而不是突然弹框。

Private：

```text
Radar Polygon
 ↓
向中心 collapse
 ↓
unlock
```

这是三个主要动画。

除此之外尽量不加。

---

# 47. 技术架构

依旧采用：

```text
Astro
TypeScript
Markdown / MDX
GitHub Pages
GitHub Actions
```

但整体架构进一步简化。

---

# 48. Core

Core 只保留：

```text
Module Registry
Search
Vault State
Shared Types
```

不再有：

```text
Activity
Relations
Timeline Engine
Knowledge Graph
```

---

# 49. 推荐结构

```text
src/

core/
├── module/
│   ├── types.ts
│   └── registry.ts
│
├── search/
│   ├── types.ts
│   └── search.ts
│
└── vault/
    └── vault.ts


shell/
├── home/
│   ├── Compass.astro
│   └── Spotlight.astro
│
├── layout/
├── glass/
└── theme/


modules/
├── me/
│
├── think/
│
├── build/
│
└── keep/
```

以后：

```text
modules/
└── <旅行与摄影合并模块>/
```

即可。2026-10-14用户明确旅行与摄影属于同一个模块，正式名称和id在后续接入时确认；该模块延后，优先完成功能。参见第57节与PLAN.md。

---

# 50. 第一版模块

V1 初始只做：

```text
Me
Think
Build
Keep
```

因此首页第一版是：

# 四边形

以后旅行/摄影合并模块加入：

```text
五边形
```

只增加一个方向，不分别建立Photography与Travel。更多实际领域加入时再继续生成对应N边形，不为凑顶点新增模块。

这本身会形成一个很有意思的效果：

> 网站的形状会随着人生内容的增加而变化。

这是 Compass 设计里非常好的一个隐含意义。

---

# 51. Compass 也是网站 Logo

建议以后把这个 N 边形 Compass 抽象成整个个人网站的视觉符号。

比如：

```text
favicon
404
loading
OG image
```

都可以使用它的简化形态。

甚至：

当前 Radar Polygon 的状态

都可以成为某一时期独有的：

> 数字指纹。

---

# 52. Codex 必须遵守的核心规则

以后所有开发都首先检查下面这些。

## 架构

```text
Home
→ Module
→ Content
```

不得增加新的主导航层。

## 导航

全局只有：

```text
Compass
Spotlight
Home link
```

不得自行增加：

```text
Dock
Navbar
Sidebar
```

## 模块

模块完全独立。

不得建立模块关系系统。

## Core

只提供：

```text
Registry
Search
Vault
Shared Types
```

## Homepage

不得增加：

```text
Blog Feed
Projects Feed
About Section
Recent Activity
Dashboard Cards
```

## Compass

必须从 Module Registry 动态生成 N 边形。

禁止写死四个模块。

## Radar

数值由：

```text
Module.count()
```

提供。

## Spotlight

Module shortcuts 与 Search 都通过 Registry 自动生成。

## 新 Module

新增模块不得要求修改：

```text
Compass
Spotlight
Home
```

## Visual

继续坚持：

```text
Minimal
Liquid Glass
Large whitespace
Few colors
Few animations
```

## Complexity

任何“很酷”的新功能如果使架构多一层：

优先不做。

---

# 53. 整个项目最终结构

可以用这一张图概括：

```text
                         HOME

                    ┌───────────┐
                    │ Compass   │
                    │           │
                    │   Radar   │
                    └─────┬─────┘
                          │
                    ModuleRegistry
                          │
           ┌──────────────┼──────────────┐
           │              │              │
          Me            Think          Build
                                          │
                                        ...
                          │
                         Keep


                           ↑
                           │
                    Module.search()
                           │
                    ┌──────┴──────┐
                    │  Spotlight  │
                    └─────────────┘
```

也可以再简单一点：

```text
纵向：

Home
 ↓
Module
 ↓
Content


横向：

Spotlight
 ├── Module
 └── Content
```

整个网站就应该这么简单。

---

# 54. 最终设计哲学

这个版本不再试图：

> 用页面告诉别人“我是一个怎样的人”。

而是：

> 给别人一个非常有辨识度的入口，然后让他们自己去探索。

Compass 表达：

> 我的世界由哪些部分组成，以及它们现在各自积累了多少。

Spotlight 表达：

> 如果你知道自己想找什么，就直接去那里。

Modules 表达：

> 每一个兴趣领域都有自己的内部秩序。

Private Entrance 表达：

> 有一些东西存在于更里面。

最终网站不是一个 Dashboard。

不是一个 Blog Theme。

不是一个 Terminal。

而应该像打开一个极简的个人操作系统首页：

```text
        Compass
           +
        Spotlight
           +
      Independent Modules
```

这是整个项目不应该再偏离的核心。
## 55. 已批准的设计与模块组织修订（2026-10-13）

用户已批准 DESIGN.md 并要求按其修改与测试。全站共享中性环境、Liquid Glass 控制材质和操作反馈；Home 保持 Compass/Spotlight 入口，模块布局各自管理。Me 为个人主页，Keep 为平面分类的网站收藏夹，Think 为温暖写意的文章/随记空间，Build 为项目概览与可选本地阶段、更新、问题记录。缺少资料时不生成假的日志、状态、成果或资源。Keep 来源新标签访问与本站说明分开；分类仅模块内 URL 状态。项目记录只属于项目，不建立全站 Activity/Timeline/Relations。详细设计见 DESIGN.md，执行顺序、范围、验收和状态见 PLAN.md 的 D1–D7。未批准后台、数据库、复杂分类、自动抓取、Private、完整移动或部署。

## 56. 已批准的交互与 Compass 统计细节（2026-10-13）

Spotlight 点击遮罩、Esc 或关闭按钮时，应有与展开衔接的收起动画；动画结束才退出模态并恢复焦点，减少动态偏好直接关闭。Me 的 Compass 数量表示其他所有启用模块真实内容数量的算术平均（包括零条模块；无其他模块则为0），因为这些方向共同构成个人。平均值先计算，再执行既有对数映射。显示与可访问名称明确这是平均值，允许小数；实际 Me 资料数量与公开搜索统计仍是实际条目数。由 Me 的元数据声明此显示规则，共享 Compass 通用处理，不在共享层按模块 id 分支；这仅是入口统计表达，不建立跨模块内容模型、Relations 或 Activity。具体执行见 PLAN.md D8。

## 57. 已批准的后续优先级与模块合并（2026-10-14）

用户明确要求后续工作以功能完善为先，真实内容以后逐步填充。优先规划第36–41节的Private能力；旅行与摄影是一个合并的未来模块，延后接入。网站收藏、项目进展、文章/随记等内容不要求在功能阶段集中补齐，也不以缺少真实素材阻塞功能设计与验证。

Private仍是现有模块的访问状态，不新增私人Dashboard或一个独立Private模块，继续沿用Compass、Spotlight与Home → Module → Content。保密技术方案、里程碑顺序、测试样本和验收标准由PLAN.md细化；不能把隐藏入口或前端布尔状态当作数据保密。

功能可以用明确标识的非敏感测试样本在隔离环境中验证，不编造作者经历、真实收藏或私人记录。其他功能只作为待选择候选，不因写入计划而获得实现授权。本次指令仅授权重排后续规划，不授权写代码、部署或提前录入内容。
