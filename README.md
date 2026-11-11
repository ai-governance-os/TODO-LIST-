# 华小 GPK Pentadbiran 专属日程与行政统筹系统 (GitHub PWA + Google Sheet & Drive 版)

专为马来西亚华小（SJKC）**GPK Pentadbiran（行政与学术副校长）** 量身打造的个人与校务多色日历、老师任务跟进与工作表管理系统。支持部署在 **GitHub Pages** 当作手机 App 使用，并直接连接您个人的 **Google Sheet** 与 **Google Drive** 空间！

---

## ✨ 核心功能亮点

1. **🎨 同日多色并列日历（一眼区分领域）**：
   - 🔵 **蓝色 — 我的 Bidang (Pentadbiran & Kurikulum)**：排课、课程会议、Pencerapan、Panitia 事务。
   - 🟢 **青色 — 学校事务 / 配合其他 Bidang**：全校性活动、配合 HEM / Kokurikulum / 校长 / PPD 交办事项。
   - 🟣 **紫色 — 个人事务 (Peribadi)**：与学校工作完全分开的私人与家庭行程。
   - 🔴/🟡 **红/琥珀色 — 公共假期 & KPM B组州属学校假期**：已内置 2026–2027 马来西亚公共假期与教育部学校假期，并支持自由添加学校特假（**Cuti Peristiwa**）。
   - **同日多色显示**：若同一天包含蓝色、青色、紫色事项，日历格子的顶部多色条、圆点及胶囊会**同时呈现每种颜色**（如示例中的 `2026-11-12`）。

2. **👥 区分“我需准备” vs “交代老师做”**：
   - **👤 我需准备 / 亲自完成**：支持设置“提前 X 天筹备提醒”，自动出现在右侧【近期筹备雷达】。
   - **👥 交代老师做 / 待收齐跟进**：专门记录需要 Ketua Panitia 或科任老师提交的报告、PBD/UASA 分数，随时在【Bidang 看板】查看谁还没交。

3. **📊 善用 Google Drive & Excel 工作表**：
   - **附件直存 Google Drive**：在任何日程下点击“上传文件”，自动将 Excel 工作表、PDF 公文、图片存进您 Google Drive 的 `GPK_Pentadbiran_Drive_Files` 文件夹并生成点击链接。
   - **Excel / CSV 校历批量导入**：支持直接上传 `.xlsx` 或 `.csv` 工作表，一键把学校 Takwim 批量导入日历；也支持一键把所有日程导出为 `.xlsx` 报表。

---

## 🚀 如何放上 GitHub 并变成手机 App？

1. 在 GitHub 新建一个仓库（Repository），将本文件夹内的所有文件上传上去。
2. 进入仓库的 **Settings** ➔ **Pages**，在 **Branch** 选择 `main`（或 `master`）并点击 **Save**。
3. 等待约 1 分钟，GitHub 会给您一个网址（例如 `https://您的账号.github.io/仓库名/`）。
4. **安装到手机桌面**：
   - **iPhone (Safari)**：打开该网址 ➔ 点击底部中间的【分享】图标 ➔ 选择 **【添加到主屏幕 (Add to Home Screen)】**。
   - **Android (Chrome)**：打开该网址 ➔ 点击右上角菜单 ➔ 选择 **【安装应用 / 添加到主屏幕】**。

---

## ☁️ 如何连接您的 Google Sheet 与 Google Drive？（只需 2 分钟）

1. 打开您的 Google Drive，新建一个空白的 **Google Sheet**（命名为：`GPK Pentadbiran 日程表`）。
2. 点击 Google Sheet 顶部菜单 **【扩展程序 (Extensions)】 ➔ 【Apps Script】**。
3. 删除原有的几行代码，将本项目 [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) 里的代码全部复制粘贴进去（也可以直接在手机/电脑 App 的【Drive与假期】页面点击“一键复制代码”），按 `Ctrl + S` 保存。
4. 点击右上角 **【部署 (Deploy)】 ➔ 【新建部署 (New deployment)】**：
   - 类型选择：**网页应用 (Web app)**
   - 执行身份 (Execute as)：**我 (Me)**
   - 谁可以访问 (Who has access)：**所有人 (Anyone)**
5. 点击部署并授权后，复制生成的 **Web App URL**，粘贴到本 App 的 **【☁️ Drive与假期】** 页面即可完成双向绑定！
