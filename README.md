# ESP32 俄乌战线评估地图网页

这是“ESP32 提供网页、手机或电脑浏览器联网加载地图”的工程。默认展示 ISW 原始地图和真实历史档案，不生成示意战线，不复制或重新配色未经授权的地理数据。

本版每 60 秒检查公开版本，不能保证战场实时或小时级真值。月、年选择已发布档案；日、周在发布方原图内部的时间条操作。没有接入小时级数据。原图中的双方活动、推进和声称不能自动视为实控。

## 开发板上使用

已导出的工程：F:\ESP32Projects\frontline_web_server。

1. VS Code 打开整个 frontline_web_server 文件夹。
2. 在 menuconfig → Frontline web server 填写路由器 Wi-Fi 名和密码。普通 ESP32 使用 esp32 目标，需要至少 4 MB Flash；ESP32-S3/C3 等须改为对应目标重新构建。
3. 编译，选择实际串口，烧录并打开监视器。
4. 手机或电脑连接同一个路由器，打开日志中的 Router address: http://...。

```powershell
. F:\Espressif\tools\Microsoft.v6.1.PowerShell_profile.ps1
cd F:\ESP32Projects\frontline_web_server
idf.py set-target esp32
idf.py menuconfig
idf.py build
idf.py -p COM3 flash monitor
```

COM3 改为实际串口。Ctrl + ] 退出监视器。

不填路由器信息时仅创建热点：Frontline-ESP32，密码 frontline2026，网页 http://192.168.4.1 。该热点不提供互联网转发：设备网页可打开，外部地图还需要浏览器有互联网。推荐接入路由器后用其分配的 IP。

本仓库包含已用于本机 ESP32 联网验证的固件源码，支持 `/api/status` 状态检查。克隆后需自行配置 Wi-Fi、编译和烧录；本机的 Wi-Fi 配置、含密码固件、日志和临时远程地址不随源码上传。

## 远程访问

联网 ESP32 可以通过电脑上的 Cloudflare 测试隧道访问。保持设备、路由器和电脑开机联网；测试地址在重启隧道后会变化，任何持有链接的人都可访问。

将官方 `cloudflared.exe` 放在导出工程相邻的 `tools` 文件夹中，然后在导出工程运行 `Start-Remote-Access.ps1 -DeviceUrl http://你的设备局域网IP/`。用 `Stop-Remote-Access.ps1` 停止；状态与日志只写入 `.private`。这两个脚本不会自动开机启动。

## 修改网页

在导出工程中修改 web/index.html、web/style.css、web/app.mjs，然后：

```powershell
.\Update-Web.ps1
idf.py build
idf.py -p COM3 flash
```

网页和 Leaflet 嵌入 Flash 并 gzip 压缩。地图及历史在浏览器处理，ESP32 不保存大容量历史，也不代理所有地图流量。

## 源码和本地预览

- dist/：直接由静态服务器或 ESP32 提供的网页。
- firmware/：ESP-IDF HTTP 服务器及 AP / APSTA 联网。
- scripts/package-esp32.mjs：更新固件网页资源。
- scripts/export-esp32.mjs：导出到 F:\ESP32Projects。
- tests/core.test.mjs：历史缺口、未来记录、月底、时区及来源校验。合成测试区域没有部署到网页。
- docs/SOURCES.md：核查记录和来源限制。
- docs/AUTHORIZED-DATA.md：将来接入授权红蓝实控与全粒度历史的格式。

```powershell
node scripts/serve.mjs
node --test tests/core.test.mjs
node scripts/package-esp32.mjs
```

静态网页无需 npm 依赖即可运行。http://127.0.0.1:5173 仅为开发电脑预览地址，不是 ESP32 地址。Leaflet 的 BSD-2-Clause 许可证随网页附带 leaflet-LICENSE.txt。
