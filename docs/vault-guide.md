# 私人内容维护指南

Milestone 4.1–4.7 已完成协议、本地命令、浏览器入口、四模块、私人搜索与统计；4.8 的正式发布/真机结果见 PLAN.md 和发布清单。

私人内容放在作者明确选择的仓库外目录，不放src/content、public、.cache、Git源文件或GitHub Actions输入中。这里不要求作者现在提供任何真实私人材料，不在聊天中索取口令。

本地命令为vault:pack、vault:verify、vault:rekey、vault:backup、vault:restore；口令交互输入，不出现在命令行参数/环境变量/日志里。新包与换口令至少16个字符，建议使用长随机口令并独立备份。每次更新只发布密文bundle；失败保留上一有效包。

```powershell
npm.cmd run vault:pack -- --source D:\MyPrivateSpace\vault.json
npm.cmd run vault:verify
npm.cmd run vault:rekey
npm.cmd run vault:backup -- --output D:\MyVaultBackup\bundle.json
npm.cmd run vault:restore -- --input D:\MyVaultBackup\bundle.json
```

路径仅是示意，请自行指定仓库外已有目录。pack/rekey要求两次输入新口令；verify/restore要求当前口令；backup仅复制已验证格式的密文，不读取明文。输出默认public/vault/bundle.json；--output仅可指向这个仓库内固定位置或明确的外部位置，backup必须外部。不能在非交互管道中输入口令；输入不回显。测试使用临时目录中的非敏感样本，生产不自动创建包。

新条目id可用`node -e "console.log(crypto.randomBytes(16).toString('hex'))"`生成并保存，修改时保持同一id。包格式为version=1、modules对象和assets对象；各模块字段见设计合同。图片要放入assets的base64数据并以asset:<id>引用，当前每图最多512KiB、最多8张，不自动上传其他文件。

模块自己的格式与计数见[vault-design.md](./vault-design.md)。Think使用安全Markdown子集，Keep保存来源与说明，Build允许独立项目或已有项目的私人补充，Me是资料补充。没有私人条目的模块继续公开使用，不要求填满。

访问：Home中心长按约1.5秒或键盘聚焦Enter打开Unlock；长按期间首页保持静止，无悬停提示，玻璃口令框直接开关。解锁后使用原有模块和Spotlight：Think显示私人文章/随记，Keep显示私人分类收藏，Build显示私人项目与补充，Me显示私人资料补充；各自留在所属模块内。站内浏览保留会话；刷新、新标签、后台、离开或前台10分钟无操作重新锁定。Shell的小锁定控制可主动结束会话，软键盘失焦本身不锁定。

私人详情直达或刷新会先显示中性提示；该提示的“解锁私人空间”调用同一个Unlock，成功后恢复当前不透明目标，无需将口令或目标标题写入存储。主动锁定清除目标片段并恢复公开模块视图。

尚未配置bundle时显示未配置说明，不使用默认口令。生产最终可以只提供已验收的功能，之后再在作者本地加密实际材料。

恢复必须先验证密文与口令；备份、换口令和删除不会撤回Git历史/他人已下载的旧包。忘记口令没有服务器找回。已解锁设备、恶意扩展或被替换的站点代码不在首版保护范围内。

入口隐蔽不等于保密；公开源码可暴露功能存在，密文可被下载后离线猜口令。16字符只是最低长度，建议由密码管理器生成独立随机长口令，不使用可预测的句子、生日或复用密码。标准算法组合、安全假设与尚未独立审计的限制见[vault-design.md的安全判断](./vault-design.md#安全判断与入口隐蔽性2026-10-15复核)。

## 从空文件开始

在自己选择的仓库外目录创建 JSON。下面仅是空结构示例，不会虚构内容；只保留需要的 modules 键也可以：

```json
{
  "version": 1,
  "modules": {
    "think": { "posts": [] },
    "keep": { "bookmarks": [] },
    "build": { "projects": [], "supplements": [] },
    "me": { "paragraphs": [], "links": [] }
  },
  "assets": {}
}
```

- Think 新条目填写 id、title、summary、date（YYYY-MM-DD）、kind（article/note）、body。id 用前述命令生成，不能使用标题作为地址；修改保留 id，删除移除数组项。
- Keep 填写 id、title、description、sourceUrl、note 数组；category 是可选的 `{id,label}`，同类共享 id/label。分类只在模块内筛选，私人标签不写入查询参数。
- Build 独立项目填写 id、title、summary、sections；milestones/updates/issues 的字段沿用本模块的内容指南。给 NEMU 添加私人补充时使用 supplements 中的 id/publicSlug/title，例如 publicSlug=nemu；补充不增加项目计数。不要加入公开记录的 slug/published 字段。
- Me 填写 paragraphs 与可选 links，不增加第二个个人档案。额外未知字段会被拒绝，精确限额与模型见设计合同和模块自有 vault.schema.ts。

Think 正文的图片写成 `![描述](asset:<id>)`，资产数据放到 assets 同 id 的 `{type,data}`；type 仅 image/png、image/jpeg、image/webp，data 是原始图片字节的规范 Base64。当前每张最大 512KiB、最多 8 张，整包明文最大 8MiB；不将私人图片放进 public。

## 更新、换口令与恢复

1. 先备份当前密文到仓库外目录；备份不会自动包含作者明文或口令，这两者独立保管。
2. 在外部源文件增改删，然后 pack → verify；命令成功后检查 Git 差异只新增/修改固定密文文件，没有外部源或口令。
3. 运行项目 lint/typecheck/test/build、相关页面浏览器验证，按已有 main 手动 Pages 发布流程发布；CI 不进行解密/重新加密。
4. 换口令用 rekey，输入旧口令和两次新口令，再 verify；旧口令应无法解开新包。旧备份仍使用当时的口令，换口令不撤销已下载的旧包。
5. 恢复使用外部密文备份及备份对应口令，restore 会先解密/校验再原子替换；失败保留当前包。成功后 verify、测试并重新发布。不要用未验证的文件直接覆盖。

本阶段实际测试覆盖新增、修改、删除、无效输入保留旧包、换口令、密文备份/恢复、错误恢复保留当前包；证据见 tests/unit/vault-files.test.ts 与 PLAN.md 的 4.2/4.8。Windows 输入/输出拒绝 NTFS Alternate Data Streams，普通外部路径仍可用。口令不接受命令行或环境变量，交互终端不回显。

若要恢复整个网站，优先在隔离目录复现最近受验版本，再通过新的 revert 提交及同一手动发布管线恢复；保留当前工作，不 reset --hard/强推。回退网站与恢复密文是两项操作，避免误将旧密文口令当成新包口令。发布源、产物和真实手机结果统一记录在 release-checklist.md，最终真实材料仍由作者以后自行录入。

