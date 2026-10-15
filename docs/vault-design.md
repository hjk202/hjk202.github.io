# Vault v1 设计合同

2026-10-14 / Milestone 4.1。NEED.md为产品来源，PLAN.md规定实施范围。本合同冻结Phase 4首版技术边界，不授权其他功能。

## 数据流与职责

作者指定的仓库外目录中的vault.json → 模块vault.server.ts校验 → 本地标准加密 → public/vault/bundle.json密文 → CI静态构建 → 浏览器解锁 → 模块vault.client.ts校验/呈现/投影 → 主动或自动锁定清理。

不新增Private模块。公开module.ts/count/search/pages及search-index.json保持构建期公开契约。Core只管理密文协议、当前标签页会话和通用适配器注册，不解释模块内容。模块自己的纯schema可供本地和浏览器适配复用；不得导入另一模块，也不得从浏览器导入.server.ts、文件读取或Astro Content组件。

## 密文协议

- JSON envelope严格字段：version=1、iterations、salt、iv、ciphertext；不允许其他字段。salt为16字节、IV为12字节，均为标准canonical base64。ciphertext包含128-bit认证tag，最少16字节。
- PBKDF2-HMAC-SHA-256 / AES-256-GCM / 128-bit tag。新包iterations=600000，v1只接受600000–1000000整数，防止恶意巨大参数占用资源；不能自行降级。每次打包随机生成新salt与IV。
- AAD为UTF-8的JSON.stringify(["personal-space-vault",1,iterations,salt,iv])，顺序固定。浏览器derived CryptoKey不可导出，仅decrypt用途；本地按操作使用最小用途。
- 单包明文最多8MiB，envelope输入最多12MiB；每个asset最多512KiB、最多8个，只支持校验签名的PNG/JPEG/WebP。v1不接SVG、PDF、视频或任意附件，不把不支持的资源改为公开链接。
- 解密内层严格字段：version=1、modules（模块id到不透明payload）、assets（不透明id到{type,data}）。最多16个模块，未知/禁用模块或错误payload在浏览器失败关闭。安全模块id遵守Registry规则；asset/私人条目id为32位小写hex随机标识。
- 私人口令新建/换口令至少16个Unicode字符、最多1024 UTF-8字节，不做trim或偷偷规范化。作者本地输入，不作为进程参数、环境变量、源码或日志保存。测试只使用明确非敏感口令。

600000是当前参考指导和原生支持的首版取值，4.2测量Node与浏览器耗时，4.8复核OPPO；性能不满足时报告，不自动弱化保护。原生方案免加密码库；此取舍不声称PBKDF2优于Argon2id，也不声称通过安全认证。

## 模块适配接口

vault.server.ts默认导出validate(payload: unknown): unknown，只用于本地打包，输出严格白名单序列化数据。自动发现文件，不维护中央模块id名单。CLI只接受仓库外明文源，输出生产位置仅允许bundle.json密文；已有包安全替换，失败不破坏上一有效包。

vault.client.ts默认导出create(payload, context): VaultView；模块自行校验并持有自己的内容模型。context只含本模块公开路由/数量/允许的公开父目标，以及受控asset URL访问。VaultView：count(publicCount)、search()、hasTarget(id)、mount(container,id?)、dispose()。返回的搜索投影仍仅title/description/url/module。框架只消费这些能力，不聚合内部条目。模块不存在私人数据时不挂载空占位卡片。

- Think：{posts:[{id,title,summary,date,kind:"article"|"note",body}]}，计可访问条目总数；按日期降序。Markdown支持段落/标题/列表/引用/代码/安全链接与asset图片，不执行HTML、MDX、JS，不自动获取远程图片。
- Keep：{bookmarks:[{id,title,description,sourceUrl,note,category?,kind?}]}，真实收藏项数，私人类别/来源只在解锁后显示。来源仅http(s)，新标签、noopener noreferrer；无预览抓取。
- Build：{projects:[独立私人项目],supplements:[{id,publicSlug,title,sections?,milestones?,updates?,issues?}]}。独立项目复用Build自己的字段语义，但使用opaque id而非标题slug；补充只能引用确实存在的公开项目。独立项目增加计数，补充/日志不增加项目数。
- Me：{paragraphs:[string],links?:[{label,url}]}，个人资料补充，不增加第二个Profile计数。Compass的peer-average继续用同伴实际可访问计数，包含零。

所有模块拒绝重复/无效id、非法日期/状态/链接、额外未知字段及超限输入。正文渲染只用安全DOM/白名单，不将整包交给innerHTML。资产引用只允许声明的asset:<id>，Blob只在当前会话内使用并在dispose/lock释放。

## 浏览器会话与导航

locked → unlocking → unlocked；失败/取消/lock回locked。unlock操作带generation，迟到响应不能复活取消后的会话。状态订阅只传是否解锁；不将密钥或内容置于window调试入口。

Astro ClientRouter仅在解锁后用于保留同一window和模块内存会话；未解锁时保留原有普通文档导航，静态页面照常生成。所有现有脚本按astro:page-load初始化、before-swap销毁，document/window监听用AbortController解除，dialog关闭计时器取消。Spotlight Enter与鼠标站内导航按同一状态选择标准导航。实际硬刷新/新标签仍锁定。无JS只能浏览公开内容，Unlock不能提交口令到URL。4.3实际回归发现全面切换会改变原有点击/返回时序，因此采用这一更小的接入，不弱化既有公开断言。

私人详情地址为已有模块route + #vault=<32hex>。先withBase处理pathname，再受控拼接fragment；不放宽公开withBase或公共索引的路径校验。刷新/直达先显示中性锁定提示，解锁后解析同一目标。缺失目标安全反馈；不创建明文静态页。document.title/canonical/OG/history title保持公开模块/中性信息，不写私人标题。

锁定：主动控制、前台10分钟无操作、visibilitychange进入后台、真正pagehide时立即发生；不监听input blur来锁定。pageshow.persisted重新锁定。ClientRouter普通站内换页不触发pagehide。私人退出/锁定不留下明文转场快照；使用无动画换页，保留现有组件内部动画。

4.3实际WebKit复验发现，替换正在合成的SVG/模态动画层会崩溃。最小处理是解锁后的Compass不播放入场/hover合成动画、根页面不参加转场快照；站内导航先关闭模态并等待两个绘制帧，然后执行ClientRouter导航。4.7补充复验确认：fallback="swap"在支持原生API的浏览器仍调用startViewTransition，因此私人会话在原生转场创建后立即skipTransition，不等到before-swap才跳过；导航先取消模态完整子树的动画，锁定时取消等待中的旧目标。正常公开入口与搜索开关仍保留已验收动画。DOM/导航编排位于Shell，Core保留协议/会话/注册契约；不是通过持久化密钥或跳过WebKit测试解决。

lock先通知模块/Spotlight同步清理DOM、投影、缓存、目标/查询、计时器与Blob，再释放payload/key；UI装饰不能延迟安全清理。站内换页仅清理当前模块DOM，Vault会话继续，重新进入重新挂载。公开页面原始DOM保持可恢复。

## 入口与公开状态

Compass中心指针长按1.5秒，短按不做任何操作；pointercancel、离开中心或松手取消。中心焦点Enter打开同一Unlock，增加可访问性，保持pointer短按无功能。按2026-10-15用户反馈，长按不改变Radar或节点外观，不显示悬停提示；Unlock和遮罩直接开关，无缩放、位移或淡入淡出。公开Spotlight动画保持。

Unlock原生dialog，与Spotlight互斥；口令不回显，错误/加载/缺包/安全API不支持有文字反馈；成功清空输入并关闭。未配置bundle时显示“尚未配置私人内容”，不提供默认密码。解锁后中心小状态及Shell的小锁定按钮，不增加导航栏或搜索命令。

## 维护、安全与验证

pack/verify/rekey/backup/restore都在本地，源目录必须在仓库外。backup只复制密文，restore先校验与口令验证再原子替换；作者自己的明文与口令备份由作者管理，不自动创建或上传。更新/删除重新打包；换口令不撤回已下载旧密文，忘记口令不能服务端找回。

公开可观测包存在/体积/版本/更新频率。不能防御已解锁设备/插件、恶意站点代码/同源XSS，不能保证JS物理内存擦除。离线口令猜测由高熵口令与KDF提高成本，前端错误延时不是安全限流。

验证：标准密码向量、Node/browser互通、wrong password/tamper/version/KDF/size/schema/resource负例；public dist/JS/JSON/map/媒体和候选Git允许列表/canary；DOM/storage/URL/log无秘密；根/base导航/dialog/搜索/计数/锁定/后台/BFCache/迟到结果；独立第五模块接入、4–7几何回归；本地维护恢复与受验发布；OPPO基础可用性集中4.8。非敏感fixtures只在隔离测试环境，最终生产未配置Vault也可完成功能验收。

参考：[Web Crypto AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)、[OWASP口令指导](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[Astro导航生命周期](https://docs.astro.build/en/guides/view-transitions/)。本轮已复核原生API、认证参数和生命周期；后续若发现合同无法安全成立，按AGENTS报告最小调整，不绕过设计。

## 安全判断与入口隐蔽性（2026-10-15复核）

四模块均具备独立私人适配器：Think文章/随记、Keep分类收藏、Build独立项目/公开项目补充、Me资料补充。一次全局解锁后，在所属模块内同时呈现可访问的公开与私人内容；不会进入一个共享私人内容页。没有数据的模块不生成假内容。

当前实现使用标准Web Crypto的口令派生与认证加密组合，不自行设计密码算法。PBKDF2-HMAC-SHA-256的600000次是OWASP对该算法的当前参考工作因子；OWASP对新系统优先推荐内存困难的Argon2id，本项目选择PBKDF2是原生浏览器支持与依赖规模的取舍，不声称更强或获得FIPS认证。AES-GCM同时校验密文和AAD，随机salt/IV每次重建；同密钥不得复用IV。代码检查和负例能提供实施证据，不能替代独立安全审计或形式化证明。

公开静态密文可被任何人下载并离线猜口令，前端等待/次数限制无法阻止它。至少16字符只是输入下限，不代表足够熵；应使用密码管理器生成的独立随机长口令。JS字符串/浏览器内存不能保证物理擦除；XSS、恶意扩展、被替换的站点脚本或已解锁设备可读取内容。旧密文的Git/下载副本不会因换口令或删包失效；没有服务端找回。

入口克制只减少视觉暴露，不能隐藏功能存在：公开源码、可访问名称和密文地址可被发现，旁观者也可能看见口令窗口或已解锁内容。口令不嵌入前端；发现入口或伪造前端状态不等于获得解密能力。此安全判断针对当前静态个人空间模型，不承诺抵抗任意攻击者。

参考：[OWASP认证加密指导](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)、上述OWASP口令指导与Web Crypto参数文档。测试样本及其公开验收口令均非真实秘密，不是生产默认口令。
