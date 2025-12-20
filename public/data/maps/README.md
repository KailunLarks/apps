# 🗺️ 矢量地图绘制指南

## 数据格式说明

我们使用 **GeoJSON** 格式存储矢量地图数据。每个地图要素包含：

```json
{
  "type": "Feature",
  "properties": {
    "id": "唯一标识",
    "name": "显示名称",
    "type": "要素类型",  // 决定渲染样式
    "researchId": "关联研究ID（可选）"
  },
  "geometry": {
    "type": "Polygon/LineString/Point",
    "coordinates": [...]
  }
}
```

### 支持的要素类型 (type)

| type | 说明 | 几何类型 | 渲染颜色 |
|------|------|----------|----------|
| `land` | 陆地轮廓 | Polygon | 浅橙色 |
| `water` | 水体（河流、湖泊） | Polygon | 浅蓝色 |
| `park` / `greenspace` | 公园/绿地 | Polygon | 浅绿色 |
| `road` | 主要道路 | LineString | 白色 |
| `street` | 次要道路 | LineString | 白色（细） |
| `building` | 建筑物 | Polygon | 橙色 |
| `bridge` | 桥梁 | LineString | 灰色 |

---

## 方法一：使用 QGIS 绘制

### 1. 安装 QGIS

下载地址：https://qgis.org/download/

macOS 推荐使用 Homebrew：
```bash
brew install --cask qgis
```

### 2. 创建新项目

1. 打开 QGIS
2. 菜单：**项目 → 新建**
3. 设置坐标系为 **EPSG:4326 (WGS 84)**
   - 右下角点击坐标系 → 搜索 "4326" → 选择

### 3. 添加底图参考（可选）

便于对照绘制：

1. 菜单：**Web → QuickMapServices → OSM → OSM Standard**
2. 如果没有此插件：**插件 → 管理和安装插件 → 搜索 "QuickMapServices" → 安装**

### 4. 创建矢量图层

为每种要素类型创建独立图层：

1. 菜单：**图层 → 创建图层 → 新建 GeoPackage 图层**
2. 设置：
   - 数据库：选择保存位置
   - 表名：`land` / `water` / `road` 等
   - 几何类型：Polygon / LineString
   - 坐标系：EPSG:4326

3. 添加属性字段：
   - `id` (文本)
   - `name` (文本)
   - `type` (文本)
   - `description` (文本)
   - `researchId` (文本)

### 5. 绘制要素

1. 选择图层 → 点击 **切换编辑** ✏️
2. 点击 **添加多边形/线要素** 工具
3. 在地图上点击绘制，右键完成
4. 填写属性信息
5. 完成后点击 **保存图层编辑**

### 6. 导出为 GeoJSON

1. 右键图层 → **导出 → 保存要素为...**
2. 格式：**GeoJSON**
3. 文件名：`2024.geojson`
4. 坐标系：**EPSG:4326**
5. 保存到：`apps/public/data/maps/`

### 7. 合并多个图层

如果有多个图层，需要合并：

1. 菜单：**矢量 → 数据管理工具 → 合并矢量图层**
2. 选择所有图层
3. 导出合并结果

---

## 方法二：直接编辑 GeoJSON

### 推荐工具

- **geojson.io** - 在线编辑器：https://geojson.io
- **VS Code + GeoJSON 插件**
- **Mapshaper** - 在线简化和编辑：https://mapshaper.org

### 使用 geojson.io

1. 打开 https://geojson.io
2. 右上角可以搜索定位到海甸岛
3. 使用左侧工具绘制：
   - 🔷 多边形（陆地、水体、建筑）
   - 📏 线（道路）
   - 📍 点（标记）
4. 点击要素，在右侧编辑 properties
5. 完成后：**Save → GeoJSON**

### 坐标格式

GeoJSON 使用 **[经度, 纬度]** 格式（注意顺序！）：

```json
"coordinates": [
  [110.3167, 20.0500],  // [经度, 纬度]
  [110.3200, 20.0520],
  ...
]
```

海甸岛大致范围：
- 经度：110.28 ~ 110.35
- 纬度：20.03 ~ 20.07

---

## 方法三：从历史地图数字化

### 步骤

1. **扫描历史地图**（高分辨率）

2. **地理配准（Georeferencing）**
   - QGIS：**栅格 → 地理配准**
   - 选择 4 个以上控制点，匹配已知坐标

3. **描图绘制**
   - 在配准后的底图上描绘要素
   - 保持图层分类

4. **导出 GeoJSON**

---

## 文件命名规范

```
apps/public/data/maps/
├── _template.geojson    # 模板参考
├── 2000.geojson         # 2000年地图
├── 2005.geojson         # 2005年地图
├── 2010.geojson         # 2010年地图
├── 2015.geojson         # 2015年地图
├── 2020.geojson         # 2020年地图
└── 2024.geojson         # 2024年地图
```

---

## 验证数据

绘制完成后，可以用以下方式验证：

1. **在线验证**：https://geojsonlint.com
2. **启动项目预览**：`cd apps && npm run dev`
3. **检查控制台**：无报错即可

---

## 常见问题

### Q: 多边形不显示？
检查坐标是否闭合（首尾坐标相同）

### Q: 要素类型不识别？
确保 `properties.type` 是支持的值（land/water/park/road 等）

### Q: 地图位置偏移？
检查坐标系是否为 WGS 84，坐标格式是否为 [经度, 纬度]

---

## 示例：最小可用地图

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "海甸岛", "type": "land" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [110.29, 20.04], [110.34, 20.04],
          [110.34, 20.07], [110.29, 20.07],
          [110.29, 20.04]
        ]]
      }
    }
  ]
}
```

保存为 `2024.geojson`，即可在地图上看到一个矩形岛屿轮廓。
