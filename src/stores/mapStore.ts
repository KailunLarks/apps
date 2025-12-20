import { create } from 'zustand';
import type { Map } from 'maplibre-gl';

interface Marker {
  id: string;
  title: string;
  coordinates: [number, number];
  researchId?: string;
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
}

export const useMapStore = create<MapState>((set) => ({
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
  isResearchPanelOpen: false,
  setResearchPanelOpen: (open) => set({ isResearchPanelOpen: open }),

  // 要打开的研究 slug
  openResearchSlug: null,
  setOpenResearchSlug: (slug) => set({ openResearchSlug: slug }),
}));
