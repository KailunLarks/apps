import { create } from 'zustand';
import type { Map } from 'maplibre-gl';

interface Marker {
  id: string;
  title: string;
  coordinates: [number, number];
  researchId?: string;
}

// SVG 动画幻灯片接口
interface SvgSlide {
  id: string;
  svg: string;
  title: string;
  annotation: string;
  duration: number;
  markerId: string | null;
}

// SVG 动画阶段接口
interface SvgStage {
  id: string;
  name: string;
  description: string;
  slides: SvgSlide[];
}

interface MapState {
  // 地图实例
  map: Map | null;
  setMap: (map: Map | null) => void;

  // 标记点
  markers: Marker[];
  setMarkers: (markers: Marker[]) => void;

  // 选中的标记
  selectedMarker: string | null;
  setSelectedMarker: (id: string | null) => void;

  // 是否显示研究面板
  isResearchPanelOpen: boolean;
  setResearchPanelOpen: (open: boolean) => void;

  // 要打开的研究 slug
  openResearchSlug: string | null;
  setOpenResearchSlug: (slug: string | null) => void;

  // SVG 动画演示状态
  isSvgPlayerOpen: boolean;
  setSvgPlayerOpen: (open: boolean) => void;
  
  // 当前播放的阶段
  currentStage: SvgStage | null;
  setCurrentStage: (stage: SvgStage | null) => void;
  
  // 当前幻灯片索引
  currentSlideIndex: number;
  setCurrentSlideIndex: (index: number) => void;
  
  // 是否自动播放
  isAutoPlay: boolean;
  setAutoPlay: (autoPlay: boolean) => void;

  // 飞往标记点
  flyToMarker: (markerId: string) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  // 地图实例
  map: null,
  setMap: (map) => set({ map }),

  // 标记点列表
  markers: [],
  setMarkers: (markers) => set({ markers }),

  // 选中的标记
  selectedMarker: null,
  setSelectedMarker: (id) => set({ selectedMarker: id }),

  // 研究面板状态
  isResearchPanelOpen: true,
  setResearchPanelOpen: (open) => set({ isResearchPanelOpen: open }),

  // 要打开的研究 slug
  openResearchSlug: null,
  setOpenResearchSlug: (slug) => set({ openResearchSlug: slug }),

  // SVG 动画演示状态
  isSvgPlayerOpen: false,
  setSvgPlayerOpen: (open) => set({ isSvgPlayerOpen: open }),
  
  currentStage: null,
  setCurrentStage: (stage) => set({ currentStage: stage, currentSlideIndex: 0 }),
  
  currentSlideIndex: 0,
  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),
  
  isAutoPlay: true,
  setAutoPlay: (autoPlay) => set({ isAutoPlay: autoPlay }),

  // 飞往标记点 (按 researchId 查找)
  flyToMarker: (markerId) => {
    const { map, markers } = get();
    // 先按 researchId 查找，再按 id 查找
    const marker = markers.find(m => m.researchId === markerId) || markers.find(m => m.id === markerId);
    if (map && marker) {
      map.flyTo({
        center: marker.coordinates,
        zoom: 16,
        duration: 1500
      });
    } else {
      console.warn('[flyToMarker] Marker not found:', markerId, 'Available markers:', markers.map(m => ({ id: m.id, researchId: m.researchId })));
    }
  },
}));
