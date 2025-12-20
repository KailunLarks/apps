/**
 * 坐标转换工具
 * WGS-84 (国际标准/GPS) <-> GCJ-02 (火星坐标系/高德、腾讯地图)
 * 
 * 高德地图使用 GCJ-02 坐标系，如果用 WGS-84 坐标绘制会有 100-700 米偏移
 */

const PI = Math.PI;
const A = 6378245.0; // 长半轴
const EE = 0.00669342162296594323; // 扁率

/**
 * 判断坐标是否在中国境内
 * 只有中国境内的坐标需要转换
 */
function isInChina(lng: number, lat: number): boolean {
  return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

function transformLat(lng: number, lat: number): number {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat 
            + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng 
            + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * WGS-84 转 GCJ-02
 * 将 GPS/国际标准坐标转换为高德坐标
 * @param lng 经度
 * @param lat 纬度
 * @returns [经度, 纬度] GCJ-02 坐标
 */
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (!isInChina(lng, lat)) {
    return [lng, lat];
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return [mgLng, mgLat];
}

/**
 * GCJ-02 转 WGS-84
 * 将高德坐标转换为 GPS/国际标准坐标
 * @param lng 经度
 * @param lat 纬度
 * @returns [经度, 纬度] WGS-84 坐标
 */
export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  if (!isInChina(lng, lat)) {
    return [lng, lat];
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  const mgLat = lat + dLat;
  const mgLng = lng + dLng;
  return [lng * 2 - mgLng, lat * 2 - mgLat];
}

/**
 * 转换 GeoJSON 坐标
 * 递归处理各种 GeoJSON 几何类型
 */
type CoordTransformFn = (lng: number, lat: number) => [number, number];

function transformCoordinates(coords: any, transformFn: CoordTransformFn): any {
  // 如果是坐标对 [lng, lat]
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number' && coords.length >= 2) {
    const [newLng, newLat] = transformFn(coords[0], coords[1]);
    return coords.length > 2 ? [newLng, newLat, ...coords.slice(2)] : [newLng, newLat];
  }
  
  // 如果是坐标数组，递归处理
  if (Array.isArray(coords)) {
    return coords.map(c => transformCoordinates(c, transformFn));
  }
  
  return coords;
}

/**
 * 转换 GeoJSON Feature 或 FeatureCollection
 * @param geojson GeoJSON 对象
 * @param transformFn 转换函数 (wgs84ToGcj02 或 gcj02ToWgs84)
 * @returns 转换后的 GeoJSON
 */
export function transformGeoJSON<T extends GeoJSON.GeoJSON>(
  geojson: T, 
  transformFn: CoordTransformFn
): T {
  const result = JSON.parse(JSON.stringify(geojson)); // 深拷贝

  function processGeometry(geometry: GeoJSON.Geometry): void {
    if (!geometry) return;
    
    if ('coordinates' in geometry) {
      (geometry as any).coordinates = transformCoordinates(
        (geometry as any).coordinates, 
        transformFn
      );
    }
    
    // GeometryCollection
    if (geometry.type === 'GeometryCollection' && 'geometries' in geometry) {
      geometry.geometries.forEach(processGeometry);
    }
  }

  if (result.type === 'FeatureCollection') {
    result.features.forEach((feature: GeoJSON.Feature) => {
      if (feature.geometry) {
        processGeometry(feature.geometry);
      }
    });
  } else if (result.type === 'Feature') {
    if (result.geometry) {
      processGeometry(result.geometry);
    }
  } else {
    // 直接是 Geometry
    processGeometry(result as GeoJSON.Geometry);
  }

  return result;
}

/**
 * 便捷方法：将 WGS-84 GeoJSON 转换为 GCJ-02
 */
export function geoJSONToGcj02<T extends GeoJSON.GeoJSON>(geojson: T): T {
  return transformGeoJSON(geojson, wgs84ToGcj02);
}

/**
 * 便捷方法：将 GCJ-02 GeoJSON 转换为 WGS-84
 */
export function geoJSONToWgs84<T extends GeoJSON.GeoJSON>(geojson: T): T {
  return transformGeoJSON(geojson, gcj02ToWgs84);
}
