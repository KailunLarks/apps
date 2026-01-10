import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '../../stores/mapStore';
import { geoJSONToGcj02, wgs84ToGcj02 } from '../../utils/coordTransform';

// 海甸岛大致中心坐标 (GCJ-02)
// 注意：如果你的坐标是 WGS-84，需要转换后使用
const HAIDIAN_CENTER_WGS84: [number, number] = [110.3167, 20.0500];
const HAIDIAN_CENTER: [number, number] = wgs84ToGcj02(...HAIDIAN_CENTER_WGS84);
const DEFAULT_ZOOM = 14;

// 标记点配色
const MAP_COLORS = {
  marker: '#f2502c',          
  markerHover: '#cb361c',
  labelColor: '#7D0000',     
};

// 地图样式配置
type MapStyleKey = 'amap' | 'amap-no-labels' | 'amap-satellite';

interface MapStyleConfig {
  name: string;
  tiles: string[];
  attribution: string;
  maxzoom: number;
}

const MAP_STYLES: Record<MapStyleKey, MapStyleConfig> = {
  'amap': {
    name: '高德标准',
    tiles: [
      'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
    ],
    attribution: '&copy; 高德地图',
    maxzoom: 18
  },
  'amap-no-labels': {
    name: '高德无标签',
    tiles: [
      'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&ltype=1&x={x}&y={y}&z={z}',
      'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&ltype=1&x={x}&y={y}&z={z}',
      'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&ltype=1&x={x}&y={y}&z={z}',
      'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&ltype=1&x={x}&y={y}&z={z}'
    ],
    attribution: '&copy; 高德地图',
    maxzoom: 18
  },
  'amap-satellite': {
    name: '高德卫星',
    tiles: [
      'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      'https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      'https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
    ],
    attribution: '&copy; 高德地图',
    maxzoom: 18
  }
};

// 根据样式key生成maplibre样式对象
const createMapStyle = (styleKey: MapStyleKey): maplibregl.StyleSpecification => {
  const config = MAP_STYLES[styleKey];
  return {
    version: 8,
    name: 'Haidian Island Map',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster',
        tiles: config.tiles,
        tileSize: 256,
        attribution: config.attribution
      }
    },
    layers: [
      {
        id: 'base-layer',
        type: 'raster',
        source: 'base-tiles',
        minzoom: 0,
        maxzoom: config.maxzoom
      }
    ]
  };
};

export default function TimeMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { setMap, setMarkers } = useMapStore();
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('amap-satellite');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [stylePickerClosing, setStylePickerClosing] = useState(false); // 菜单关闭动画
  const [showTip, setShowTip] = useState(true); // 首次加载提示
  const [tipClosing, setTipClosing] = useState(false); // 提示关闭动画状态
  const markersBindedRef = useRef(false); // 追踪事件是否已绑定
  const areasBindedRef = useRef(false); // 追踪区域事件是否已绑定
  const hoveredAreaId = useRef<string | null>(null); // 当前高亮的区域ID
  const markersDataRef = useRef<any | null>(null); // 存储 markers 数据以便区域 popup 访问

  // 关闭提示（带动画）
  const closeTip = () => {
    setTipClosing(true);
    setTimeout(() => {
      setShowTip(false);
      setTipClosing(false);
    }, 150); // 与动画时长一致
  };

  // 切换样式选择器（带动画）
  const toggleStylePicker = () => {
    // 若提示弹窗打开，点击菜单按钮时先关闭提示
    if (showTip && !tipClosing) {
      closeTip();
    }

    if (showStylePicker) {
      // 关闭动画
      setStylePickerClosing(true);
      setTimeout(() => {
        setShowStylePicker(false);
        setStylePickerClosing(false);
      }, 150);
    } else {
      setShowStylePicker(true);
    }
  };

  // 关闭样式选择器（带动画）
  const closeStylePicker = () => {
    setStylePickerClosing(true);
    setTimeout(() => {
      setShowStylePicker(false);
      setStylePickerClosing(false);
    }, 150);
  };

  // 加载标记点 - 定义在前面，避免调用顺序问题
  const loadMarkers = async (bindEvents = false) => {
    if (!map.current) return;

    try {
      const response = await fetch('/data/markers.json');
      if (!response.ok) return;

      const markersDataRaw = await response.json();
      
      // WGS-84 转 GCJ-02，确保与高德底图对齐
      const markersData = geoJSONToGcj02(markersDataRaw);
      // 缓存 markers 数据，供区域 click 时查找关联 marker
      markersDataRef.current = markersData;

      // 将 markers 转换并存入 store，供 flyToMarker 等功能使用
      const markersForStore = markersData.features.map((feature: any) => ({
        id: feature.id,
        title: feature.properties?.name || '',
        coordinates: feature.geometry.coordinates as [number, number],
        researchId: feature.properties?.researchId || null,
      }));
      setMarkers(markersForStore);

      // 收集所有唯一的图标名称并预加载，同时更新 GeoJSON 数据
      const iconNames = new Set<string>();
      markersData.features.forEach((feature: any) => {
        if (feature.properties?.icon) {
          // 去掉.svg扩展名作为图标ID
          const iconId = feature.properties.icon.replace('.svg', '');
          feature.properties.iconId = iconId; // 添加处理后的图标ID
          iconNames.add(feature.properties.icon);
        } else {
          feature.properties.iconId = 'default-marker'; // 没有指定图标时使用默认
        }
      });

      // 辅助函数：加载SVG为ImageData
      const loadSvgAsImage = (url: string, size: number = 32): Promise<ImageData> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, size, size);
            resolve(ctx.getImageData(0, 0, size, size));
          };
          img.onerror = reject;
          img.src = url;
        });
      };

      // 预加载SVG图标到MapLibre
      const iconPromises = Array.from(iconNames).map(async (iconName) => {
        try {
          const iconId = iconName.replace('.svg', '');
          // 检查图标是否已存在
          if (map.current!.hasImage(iconId)) return;

          // 通过Image对象加载SVG并转换为ImageData
          const imageData = await loadSvgAsImage(`/icons/${iconName}`, 48);
          map.current!.addImage(iconId, imageData, { pixelRatio: 1.5 });
        } catch (error) {
          console.warn(`Failed to load icon ${iconName}:`, error);
        }
      });

      // 等待所有图标加载完成
      await Promise.all(iconPromises);

      // 移除旧标记图层（如果存在）
      if (map.current.getLayer('markers-layer')) {
        map.current.removeLayer('markers-layer');
      }
      if (map.current.getLayer('markers-labels')) {
        map.current.removeLayer('markers-labels');
      }
      if (map.current.getSource('markers')) {
        map.current.removeSource('markers');
      }

      // 清理之前的HTML markers
      if ((map.current as any)._customMarkers) {
        (map.current as any)._customMarkers.forEach((marker: maplibregl.Marker) => marker.remove());
        (map.current as any)._customMarkers = null;
      }

      // 添加标记点数据源
      map.current.addSource('markers', {
        type: 'geojson',
        data: markersData
      });

      // 添加标记点图层 - 使用symbol类型显示SVG图标
      map.current.addLayer({
        id: 'markers-layer',
        type: 'symbol',
        source: 'markers',
        layout: {
          'icon-image': [
            'coalesce',
            ['image', ['get', 'iconId']],
            'default-marker'
          ],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-anchor': 'center'
        },
        paint: {
          'icon-opacity': 1
        }
      });

      // 添加标签
      map.current.addLayer({
        id: 'markers-labels',
        type: 'symbol',
        source: 'markers',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 0.8],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': MAP_COLORS.labelColor,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1
        }
      });

      // 只在首次加载时绑定事件（避免重复绑定）
      if (bindEvents && !markersBindedRef.current) {
        markersBindedRef.current = true;
        
        // 点击标记点事件处理函数
        const handleMarkerClick = (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features?.[0]) return;
          
          // 阻止事件冒泡到区域图层
          e.preventDefault();
          e.originalEvent.stopPropagation();

          const feature = e.features[0];
          const coordinates = (feature.geometry as any).coordinates.slice();
          const { name, description, researchId, icon, popupSvg } = feature.properties || {};

          // 构建图标 HTML（小图标）
          const iconHtml = icon 
            ? `<img src="/icons/${icon}" alt="${name}" class="w-10 h-10 object-contain flex-shrink-0" />`
            : '';

          // 构建大SVG图片 HTML
          const popupSvgHtml = popupSvg
            ? `<div class="mt-0 mb-0 flex justify-center w-full rounded-t-[8px] overflow-hidden">
                 <img src="/icons/${popupSvg}" alt="${name} 大图" class="w-full h-32 object-contain" />
               </div>`
            : '';

          // 创建弹窗
          const popup = new maplibregl.Popup({ offset: 15 })
            .setLngLat(coordinates)
            .setHTML(`
              <div class=" w-full">
                ${popupSvgHtml}
                <div class="p-4">
                  <div class="flex items-center gap-3 mb-2">

                    <h3 class="m-0 text-xl font-semibold text-gray-700">${name}</h3>
                  </div>
                  <p class="m-0 mb-1 text-base text-gray-500">${description || ''}</p>
                </div>
              </div>
            `)
            .addTo(map.current!);

          // 添加关闭动画支持
          const popupEl = popup.getElement();
          const originalRemove = popup.remove.bind(popup);
          popup.remove = () => {
            popupEl.classList.add('is-closing');
            setTimeout(() => {
              originalRemove();
            }, 150);
            return popup;
          };
        };

        // 鼠标悬停效果处理函数
        const handleMarkerMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';

          // 联动高亮区域
          const feature = e.features?.[0];
          const researchId = feature?.properties?.researchId;
          
          if (researchId && map.current) {
             if (hoveredAreaId.current && hoveredAreaId.current !== researchId) {
                map.current.setFeatureState(
                    { source: 'areas-source', id: hoveredAreaId.current },
                    { hover: false }
                );
             }
             
             map.current.setFeatureState(
                { source: 'areas-source', id: researchId },
                { hover: true }
             );
             hoveredAreaId.current = researchId;
          }
        };

        const handleMarkerMouseLeave = () => {
          if (map.current) map.current.getCanvas().style.cursor = '';

          // 清除高亮
          if (hoveredAreaId.current && map.current) {
            map.current.setFeatureState(
                { source: 'areas-source', id: hoveredAreaId.current },
                { hover: false }
            );
            hoveredAreaId.current = null;
          }
        };

        // 为图标层和标签层都绑定点击事件
        map.current.on('click', 'markers-layer', handleMarkerClick);
        map.current.on('click', 'markers-labels', handleMarkerClick);

        // 为图标层和标签层都绑定悬停事件
        map.current.on('mouseenter', 'markers-layer', handleMarkerMouseEnter);
        map.current.on('mouseenter', 'markers-labels', handleMarkerMouseEnter);
        map.current.on('mouseleave', 'markers-layer', handleMarkerMouseLeave);
        map.current.on('mouseleave', 'markers-labels', handleMarkerMouseLeave);
      }
    } catch (error) {
      console.error('Failed to load markers:', error);
    }
  };
  const loadAreas = async (bindEvents = false) => {
    if (!map.current) return;

    try {
      const response = await fetch('/data/maps/current.geojson');
      if (!response.ok) return;

      const areaDataRaw = await response.json();
      
      // WGS-84 转 GCJ-02，确保与高德底图对齐
      const areaData = geoJSONToGcj02(areaDataRaw);

      // 1. 添加数据源
      if (!map.current.getSource('areas-source')) {
        map.current.addSource('areas-source', {
          type: 'geojson',
          data: areaData,
          promoteId: 'id' // 使用 properties.id 作为 feature id
        });
      }

      // 2. 添加填充图层 (背景色)
      const beforeLayerId = map.current.getLayer('markers-layer') ? 'markers-layer' : undefined;

      if (!map.current.getLayer('areas-fill')) {
        map.current.addLayer({
          id: 'areas-fill',
          type: 'fill',
          source: 'areas-source',
          paint: {
            'fill-color': MAP_COLORS.marker,
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              0.4, // hover 状态透明度
              0.1  // 默认透明度
            ]
          }
        }, beforeLayerId);
      }

      // 3. 添加描边图层 (边框)
      if (!map.current.getLayer('areas-line')) {
        map.current.addLayer({
          id: 'areas-line',
          type: 'line',
          source: 'areas-source',
          paint: {
            'line-color': MAP_COLORS.marker,
            'line-width': 2,
            'line-opacity': 0.6
          }
        }, beforeLayerId);
      }

      // 只在首次加载时绑定事件（避免重复绑定）
      if (bindEvents && !areasBindedRef.current) {
        areasBindedRef.current = true;

        // 点击区域事件 - 直接弹出关联 marker 的弹窗
        map.current.on('click', 'areas-fill', (e) => {
          if (!e.features?.length) return;
          // 检查是否同时点击到了 marker，如果是则不处理（让 marker 的事件处理）
          const markersAtPoint = map.current?.queryRenderedFeatures(e.point, { layers: ['markers-layer'] });
          if (markersAtPoint && markersAtPoint.length > 0) {
            return;
          }
          // 选中面积最小的区域
          const getPolygonArea = (feature: any) => {
            // 只支持 Polygon/MultiPolygon
            const coords = feature.geometry?.coordinates;
            if (!coords) return Infinity;
            function ringArea(ring: any[]) {
              let area = 0;
              for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
                area += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
              }
              return Math.abs(area / 2);
            }
            if (feature.geometry.type === 'Polygon') {
              return Math.abs(ringArea(coords[0]));
            } else if (feature.geometry.type === 'MultiPolygon') {
              return Math.min(...coords.map((poly: any) => ringArea(poly[0])));
            }
            return Infinity;
          };
          const minFeature = e.features.reduce((min, cur) => getPolygonArea(cur) < getPolygonArea(min) ? cur : min, e.features[0]);
          const areaProps = minFeature.properties || {};
          const areaId = areaProps.id;

          // 从缓存的 markersDataRef 中查找关联的 marker（通过 researchId 匹配区域 id）
          let linkedMarker: any = null;
          if (markersDataRef.current && areaId) {
            linkedMarker = markersDataRef.current.features?.find((f: any) => f.properties?.researchId === areaId);
          }

          // 如果找到关联的 marker，使用 marker 的坐标和属性弹出与 marker 一致的弹窗
          if (linkedMarker) {
            const markerCoordinates = linkedMarker.geometry.coordinates.slice();
            const { name, description, researchId, icon, popupSvg } = linkedMarker.properties || {};

            // 构建大SVG图片 HTML（与 marker 弹窗一致）
            const popupSvgHtml = popupSvg
              ? `<div class="mt-0 mb-0 flex justify-center w-full rounded-t-[8px] overflow-hidden">
                   <img src="/icons/${popupSvg}" alt="${name} 大图" class="w-full h-32 object-contain" />
                 </div>`
              : '';

            const popup = new maplibregl.Popup({ offset: 15 })
              .setLngLat(markerCoordinates)
              .setHTML(`
                <div class=" w-full">
                  ${popupSvgHtml}
                  <div class="p-4">
                    <div class="flex items-center gap-3 mb-2">

                      <h3 class="m-0 text-xl font-semibold text-gray-700">${name}</h3>
                    </div>
                    <p class="m-0 mb-1 text-base text-gray-500">${description || ''}</p>
                    ${researchId ? `<a href="/research/${researchId}" class="text-orange-500 text-sm hover:text-orange-600">查看研究 →</a>` : ''}
                  </div>
                </div>
              `)
              .addTo(map.current!);

            const popupEl = popup.getElement();
            const originalRemove = popup.remove.bind(popup);
            popup.remove = () => {
              popupEl.classList.add('is-closing');
              setTimeout(() => {
                originalRemove();
              }, 150);
              return popup;
            };
          }
        });

        // 鼠标悬停效果 - 使用 mousemove 更可靠处理重叠区域
        map.current.on('mousemove', 'areas-fill', (e) => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
          if (!e.features?.length) return;
          // 选中面积最小的区域
          const getPolygonArea = (feature: any) => {
            const coords = feature.geometry?.coordinates;
            if (!coords) return Infinity;
            function ringArea(ring: any[]) {
              let area = 0;
              for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
                area += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
              }
              return Math.abs(area / 2);
            }
            if (feature.geometry.type === 'Polygon') {
              return Math.abs(ringArea(coords[0]));
            } else if (feature.geometry.type === 'MultiPolygon') {
              return Math.min(...coords.map((poly: any) => ringArea(poly[0])));
            }
            return Infinity;
          };
          const minFeature = e.features.reduce((min, cur) => getPolygonArea(cur) < getPolygonArea(min) ? cur : min, e.features[0]);
          const areaId = minFeature?.properties?.id;
          if (areaId && map.current) {
            if (hoveredAreaId.current && hoveredAreaId.current !== areaId) {
              map.current.setFeatureState(
                { source: 'areas-source', id: hoveredAreaId.current },
                { hover: false }
              );
            }
            if (hoveredAreaId.current !== areaId) {
              map.current.setFeatureState(
                { source: 'areas-source', id: areaId },
                { hover: true }
              );
              hoveredAreaId.current = areaId;
            }
          }
        });

        map.current.on('mouseleave', 'areas-fill', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';

          // 清除所有高亮
          if (hoveredAreaId.current && map.current) {
            map.current.setFeatureState(
              { source: 'areas-source', id: hoveredAreaId.current },
              { hover: false }
            );
            hoveredAreaId.current = null;
          }
        });
      }

    } catch (error) {
      console.error('加载区域失败:', error);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // 初始化地图
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: createMapStyle(currentStyle),
      center: HAIDIAN_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 18,
      minZoom: 10,
    });

    // 添加导航控件
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    // 地图加载完成
    map.current.on('load', () => {
      setIsLoaded(true);
      setMap(map.current);
      
      // 添加默认标记图标（圆形）
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      
      // 绘制圆形标记
      ctx.fillStyle = MAP_COLORS.marker;
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, 2 * Math.PI);
      ctx.fill();
      
      // 添加白色边框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      const defaultImageData = ctx.getImageData(0, 0, 32, 32);
      map.current!.addImage('default-marker', defaultImageData);
      
      // 先加载标记点，再加载区域（保证区域点击可以读取到标记点数据）
      loadMarkers(true);
      loadAreas(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 切换地图样式
  const switchMapStyle = (styleKey: MapStyleKey) => {
    if (!map.current || styleKey === currentStyle) return;

    // 保存当前视图状态
    const center = map.current.getCenter();
    const zoom = map.current.getZoom();

    // 切换样式
    map.current.setStyle(createMapStyle(styleKey));

    setTimeout(() => {
      // 切换样式时优先加载 markers，再加载区域
      loadMarkers(false);
      map.current?.setCenter(center);
      map.current?.setZoom(zoom);
      loadAreas();
    }, 100);

    setCurrentStyle(styleKey);
    setShowStylePicker(false);
  };

  return (
    <>
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      
      {/* 地图样式切换器 */}
      <div className="absolute bottom-8 right-4 z-10">
        <button
          onClick={toggleStylePicker}
          className="bg-white px-3 py-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          {MAP_STYLES[currentStyle].name}
        </button>
        
        {showStylePicker && (
          <div 
            className="absolute bottom-full right-0 mb-2 bg-white rounded-lg overflow-hidden min-w-35"
            style={{
              transformOrigin: 'bottom right',
              filter: 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.15)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1))',
              animation: stylePickerClosing 
                ? 'menu-scale-out 150ms ease-in both' 
                : 'menu-scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both'
            }}
          >
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => { switchMapStyle(key); closeStylePicker(); }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                  key === currentStyle ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700'
                }`}
              >
                {MAP_STYLES[key].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 首次加载提示 */}
      {showTip && (
        <div 
          className="absolute bottom-20 right-4 z-10 max-w-70"
          style={{
            filter: 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.20)) drop-shadow(0 6px 18px rgba(0, 0, 0, 0.08))',
            transformOrigin: 'bottom right',
            animation: tipClosing 
              ? 'menu-scale-out 150ms ease-in both' 
              : 'menu-scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both'
          }}
        >
          <div 
            className="bg-white p-4 relative"
            style={{
              borderRadius: 'var(--border-radius-border-radius-middle, 8px)'
            }}
          >
            <button
              onClick={closeTip}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full"
              aria-label="关闭提示"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3 className="m-0 mb-2 text-base font-semibold text-gray-700 pr-6">地图提示</h3>
            <p className="m-0  text-sm text-gray-500 leading-relaxed">
              可切换至标准地图样式以查看更详细的地形信息
            </p>
            {/* <div className="flex gap-2">
              <button
                onClick={() => { switchMapStyle('amap'); closeTip(); }}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
              >
                高德标准
              </button>
              <button
                onClick={() => { switchMapStyle('amap-satellite'); closeTip(); }}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                高德卫星
              </button>
            </div> */}
          </div>
          {/* 使用与 MapLibre popup 相同的 SVG 圆润箭头 */}
          <div 
            className="absolute -bottom-2 right-8"
            style={{
              width: '16px',
              height: '8px',
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8' viewBox='0 0 16 8' fill='none'%3E%3Cpath d='M16 0H0C4.12448 0 4.76977 5 8 5C11.2302 5 11.8755 0 16 0Z' fill='white'/%3E%3C/svg%3E") no-repeat center / contain`
            }}
          />
        </div>
      )}
    </>
  );
}
