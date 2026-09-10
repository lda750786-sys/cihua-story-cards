# 词话 · 故事背单词（只读在线版）

用完整故事和词卡记忆英语与西班牙语词汇。**这是个人故事库的只读在线副本**：
可以浏览故事卡、翻卡复习、随机抽词，但不能在线生成或删除。

## 这是什么

- **在线能做的**：浏览故事库、故事卡/单词卡两种模式复习、按词库随机抽词。
- **在线不能做的**：生成新故事、删除卡片、生成配图。这些需要在本地工作台完成。
- **数据来源**：`data/cards.json` 由本地工作台导出，只在构建时生成，页面本身不做任何写操作。

卡片内容与词汇由本站主人创作，不使用任何追踪、不加载第三方脚本。

## 来源与致谢

界面、数据格式与词库来自 **[cihua-story-cards](https://github.com/ericffu/cihua-story-cards)**（词话 · 故事背单词）。
本项目是它的只读部署副本，遵循其「学习记录只保存在本地、不上传云端」的设计，
因此本仓库只包含主人主动选择发布的故事卡。

上游仓库目前在 README 中说明尚未为代码与品牌素材选定项目级许可证，
因此本仓库**不包含上游的品牌素材**（logo、应用图标），并在页面上标注了来源。

英语词库来自 MIT 许可的 ECDICT；西语候选词基于 CC BY-SA 3.0 的 FrequencyWords 数据。
详见上游仓库的 `THIRD_PARTY_NOTICES.md`。

## 结构

```text
index.html                  工作台页面（静态只读模式）
app.js / styles.css         前端
data/cards.json             故事卡数据（构建时导出）
data/vocabulary/*.json      词库（用于浏览器内随机抽词）
data/vocabulary-sources.json 词库来源与许可
data/meta.json              构建信息与统计
.nojekyll                   关闭 GitHub Pages 的 Jekyll 处理
```

## 更新内容

在本地工作台生成新卡片后，重新导出并推送即可：

```bash
python3 scripts/build_public_site.py --out public-site --clean
```

然后把 `public-site/` 的内容提交到这个仓库。
