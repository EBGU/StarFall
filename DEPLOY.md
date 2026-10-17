# 发布与手机适配说明

> 目标：把这个纯静态工程放到 GitHub Pages / Netlify / itch.io 上，让玩家用手机浏览器直接玩，
> 并支持「添加到主屏幕」后像 App 一样全屏离线运行。

---

## 一、它是什么形态

纯静态：`index.html` + `css/` + `js/` + `icons/` + `manifest.webmanifest` + `sw.js`。
**没有任何构建步骤、没有 npm、没有后端。** 把整个文件夹原样上传即可。

所有路径都是相对的（`js/…`、`css/…`、`./`），所以放在 `用户名.github.io/仓库名/` 这种子路径下也能正常工作。

---

## 二、GitHub Pages（推荐，免费 + HTTPS）

1. 在 GitHub 新建一个仓库（Public），例如 `starfall`。
2. 把 `starfall/` 目录**里面的内容**推到仓库根目录（`index.html` 必须在根）：

```bash
cd starfall
git init
git add .
git commit -m "拾星纪·长庚 初版"
git branch -M main
git remote add origin https://github.com/<你的用户名>/starfall.git
git push -u origin main
```

3. 仓库 → **Settings → Pages** → Source 选 `Deploy from a branch` → Branch `main` / `/ (root)` → Save。
4. 等 1 分钟，访问 `https://<你的用户名>.github.io/starfall/`。

> Service Worker 只在 **https** 下注册；GitHub Pages 默认就是 https，所以离线缓存和「添加到主屏幕」可用。
> 如果用 `file://` 打开（本地双击），SW 不会注册，但游戏本身照常运行。

### 用命令行推送（如果你不想装 Git 图形界面）

```powershell
cd C:\Users\YJIA\Downloads\dsh_tmp\starfall
git init
git add .
git commit -m "init"
git remote add origin https://github.com/<你的用户名>/starfall.git
git push -u origin main
```

---

## 三、其他平台

| 平台 | 做法 | 注意 |
| --- | --- | --- |
| **Netlify** | 打开 app.netlify.com/drop，把 `starfall` 文件夹拖进去 | 秒级部署，自动 HTTPS，免费 |
| **Vercel** | `vercel` CLI 或网页导入仓库，Framework 选 Other | 无构建命令，输出目录填 `.` |
| **Cloudflare Pages** | 连接仓库，Build command 留空，Output directory `/` | 全球 CDN，国内访问相对好一点 |
| **itch.io** | 上传 zip（zip 根目录必须是 `index.html`），勾选 *This file will be played in the browser* | itch 用 iframe + 子路径，**`sw.js` 可能注册失败**，离线功能会失效，其余正常 |
| **自己的服务器** | 任意静态托管（nginx / OSS / COS） | 必须 https，否则 iOS 不给装 PWA |

---

## 四、手机上要怎么玩

- **操作**：左半屏任意位置按住拖动 = 虚拟摇杆；右下四个键 `攻 / 风 / 星 / 疾`；靠近可交互物时多出 `触` 键。
- **对话推进**：轻触屏幕任意处。
- **横屏体验更好**：竖屏也能玩，进入游戏时顶部会提示一次「横屏体验更佳」。
- **声音**：iOS 必须在**用户点击后**才能出声——点「开始旅程」就会初始化音频，符合系统要求；切后台再回来会自动 resume。
- **添加到主屏幕**：
  - iPhone：Safari → 分享 → 「添加到主屏幕」
  - Android：Chrome → 右上角 → 「安装应用」/「添加到主屏幕」
  - 之后从桌面图标进入，是全屏、无地址栏、可离线的。

---

## 五、为手机做的适配清单

| 项目 | 处理 |
| --- | --- |
| 触屏输入 | 新增虚拟摇杆（左半屏动态摇杆，带死区 0.16 与模拟量）+ 5 个动作键；摇杆推杆幅度直接映射移速 |
| 攻击判定 | 手机不需要精确朝向：出招自动锁定最近敌人（原自动索敌在移动端同样生效），贴身必中 |
| HUD 布局 | `<=860px` 媒体查询整体缩放：任务栏、小地图、血条、对话框（立绘 118px）、残响图鉴改为上下分栏 |
| 按钮锚定 | 小屏改用 `px` 而非 `vw/vh`，避免真机上 vw 计算偏差把按钮推出屏幕 |
| 分辨率 | DPR 上限 1.75（桌面 2），避免 iPhone 3x 屏每帧渲染 3.6M 像素 |
| 泛光 | 移动端跳过 `ctx.filter: blur()`，改用 1/8 降采样 + 平滑放大当柔光（移动 Safari 上 blur 很贵） |
| 草海 | 网格间距 17px → 24px，粒子数量 ×0.6 |
| 自适应降级 | 运行时监控帧率，低于 44fps 连续 2.5 秒自动降档（关泛光 → 再降 DPR），控制台会打印 `[quality] -> level N` |
| 输入延迟 | 按钮用 `pointerdown` 立即触发，不用 `click` |
| 页面行为 | `touch-action:none` 防止双指缩放/下拉刷新；`100dvh` 适配地址栏收缩；`overscroll-behavior:none` |
| PWA | `manifest.webmanifest` + `sw.js`（stale-while-revalidate）+ 192/512/maskable 图标 |
| 音频 | `AudioContext` 在点击手势内创建；`visibilitychange` 时自动 resume |
| 存档 | 仍是 localStorage（PWA 内同样有效）；换设备不会同步，属于已知限制 |

---

## 六、调试技巧

| 场景 | 做法 |
| --- | --- |
| 桌面强制触屏 UI | 地址后加 `?touch=1` |
| 直接跳到某段剧情 | `?shot=1&stage=boss1&x=4060&y=1700`（完整列表见 README 第九节） |
| 看帧率降级是否触发 | 打开 F12 Console，观察 `[quality] -> level` |
| 手机连电脑调试 | 同一局域网跑 `python -m http.server 8000`，手机访问 `http://<电脑IP>:8000`（此时无 SW，但能验证触屏/布局） |
| 模拟 iPhone | Chrome DevTools → 设备工具栏 → iPhone 12 Pro，刷新后看 HUD 是否拥挤 |

---

## 七、已知限制

- 竖屏时可视范围窄，属于横屏动作游戏的设计取舍；HUD 已做竖屏适配但体验仍不如横屏。
- 首次进入需要现场烘焙 7200×4800 的大陆底图，中端手机约 3–5 秒（显示「正在编织星图」），期间页面会短暂无响应属正常。
- 低端机（几年前的千元机）即使降档后也可能掉到 30fps 左右。
- 没有手柄支持、没有云存档、没有多语言。
