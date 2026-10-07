# 可选的授权实控数据接口

当前版本只展示 ISW 原始发布内容，不内置或抓取 ISW / DeepState 的实控多边形。独立绘图须由维护者核验数据源、许可证、覆盖范围和时间定义；JSON 内的授权声明不证明授权或权威性。

在 `web/data-config.json`（网页源代码中为 `dist/data-config.json`）设置 `authorizedFeedUrl` 为允许浏览器跨域访问的 HTTPS 快照索引。禁止在公开 URL 中放 API 密钥。浏览器直接加载地图，ESP32 不存储完整历史。没有配置时“独立地图”显示缺数据状态，不生成示意战线。

```json
{
  "version": 1,
  "source": {
    "name": "填写经过核验的发布机构",
    "url": "https://your-authorized-provider.example/",
    "permissionConfirmed": true,
    "permissionReference": "填写实际许可或书面授权依据",
    "temporalResolution": "day"
  },
  "snapshots": []
}
```

每条真实快照需有唯一 `id`、`observedAt`、`publishedAt`、`coverage`、`geojsonUrl`。时间用带时区的 ISO 8601，例如 `2026-10-06T21:00:00Z`。可选 `validUntil` 仅填写发布方明确声明的有效区间；不提供时只在快照精确时间显示，不跨缺口延用。

GeoJSON 为 `FeatureCollection`；区域为闭合 `Polygon` 或 `MultiPolygon`，坐标 `[经度,纬度]`。`properties.control` 明确填写 `russia`、`ukraine`、`disputed`、`unknown`；`properties.assessment` 明确填写 `assessed`、`claimed`。`name` 可选。不能把一方范围之外直接推为另一方控制。

俄方评估控制红色，乌方蓝色，争议黄色虚线，未知灰色；声称范围只有虚线、不填充。小时 / 天 / 星期 / 月 / 年改变目标时间，仅显示不晚于目标且处于来源有效窗口内的记录。小时回放还须来源声明 `temporalResolution: "hour"`。这些约束防止网页补造数据，不保证第三方数据本身准确。
