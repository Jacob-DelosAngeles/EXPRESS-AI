import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // Map Data
  vehicles: [],
  potholes: [],
  pavement: [],
  iriFiles: [], // Array of { id, filename, segments, stats, visible, color }
  potholeFiles: [], // Array of { id, filename, data, visible }

  // ROI / Lasso State
  roiPolygon: null, // [[lat, lon], ...]

  // UI State
  activeLayers: {
    vehicles: true,
    potholes: true,
    pavement: true,
    iri: true, // Global toggle for all IRI files
    showBudgetCalculator: false,
    showCostHeatmap: false,
    showHidden: false
  },

  // Map State
  mapStyle: 'Google Hybrid',
  lastZoomedSignature: "",
  mapCenter: [14.1648, 121.2413],
  mapZoom: 13,

  // Actions
  setVehicles: (data) => set({ vehicles: data }),
  setPotholes: (data) => set({ potholes: data }),
  setPavement: (data) => set({ pavement: data }),

  // IRI Actions
  // IRI Actions
  setIriFiles: (files) => set({ iriFiles: files }),
  addIriFile: (fileData) => set((state) => ({
    iriFiles: [...state.iriFiles, { ...fileData, visible: true, id: fileData.id || (Date.now() + Math.random()) }]
  })),
  removeIriFile: (id) => set((state) => ({
    iriFiles: state.iriFiles.filter(f => f.id !== id)
  })),
  toggleIriFile: (id) => set((state) => ({
    iriFiles: state.iriFiles.map(f => f.id === id ? { ...f, visible: !f.visible } : f)
  })),
  clearIriFiles: () => set({ iriFiles: [] }),

  // Pothole File Actions
  potholeFiles: [],
  setPotholeFiles: (files) => set({ potholeFiles: files }),
  addPotholeFile: (fileData) => set((state) => ({
    potholeFiles: [...state.potholeFiles, { ...fileData, visible: true, id: fileData.id || (Date.now() + Math.random()) }]
  })),
  removePotholeFile: (id) => set((state) => ({
    potholeFiles: state.potholeFiles.filter(f => f.id !== id)
  })),
  togglePotholeFile: (id) => set((state) => ({
    potholeFiles: state.potholeFiles.map(f => f.id === id ? { ...f, visible: !f.visible } : f)
  })),
  clearPotholeFiles: () => set({ potholeFiles: [] }),

  // Vehicle File Actions
  vehicleFiles: [],
  setVehicleFiles: (files) => set({ vehicleFiles: files }),
  addVehicleFile: (fileData) => set((state) => ({
    vehicleFiles: [...state.vehicleFiles, { ...fileData, visible: true, id: fileData.id || (Date.now() + Math.random()) }]
  })),
  removeVehicleFile: (id) => set((state) => ({
    vehicleFiles: state.vehicleFiles.filter(f => f.id !== id)
  })),
  toggleVehicleFile: (id) => set((state) => ({
    vehicleFiles: state.vehicleFiles.map(f => f.id === id ? { ...f, visible: !f.visible } : f)
  })),
  clearVehicleFiles: () => set({ vehicleFiles: [] }),

  // Pavement File Actions
  pavementFiles: [],
  setPavementFiles: (files) => set({ pavementFiles: files }),
  addPavementFile: (fileData) => set((state) => ({
    pavementFiles: [...state.pavementFiles, { ...fileData, visible: true, id: fileData.id || (Date.now() + Math.random()) }]
  })),
  removePavementFile: (id) => set((state) => ({
    pavementFiles: state.pavementFiles.filter(f => f.id !== id)
  })),
  togglePavementFile: (id) => set((state) => ({
    pavementFiles: state.pavementFiles.map(f => f.id === id ? { ...f, visible: !f.visible } : f)
  })),
  clearPavementFiles: () => set({ pavementFiles: [] }),

  toggleLayer: (layer) => set((state) => ({
    activeLayers: {
      ...state.activeLayers,
      [layer]: !state.activeLayers[layer]
    }
  })),

  setMapStyle: (style) => set({ mapStyle: style }),
  setLastZoomedSignature: (sig) => set({ lastZoomedSignature: sig }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

  // ROI Actions
  setRoiPolygon: (poly) => set({ roiPolygon: poly }),
  clearRoiPolygon: () => set({ roiPolygon: null }),

  // Data Cleaning Actions
  // These calls the persistent backend override endpoint
  toggleDetectionVisibility: async (uploadId, detectionIdx, isHidden) => {
    if (!uploadId) {
      console.error("Cannot toggle visibility: uploadId is missing");
      return false;
    }
    try {
      const { default: api } = await import('../services/api');
      const response = await api.patch(`/uploads/${uploadId}/override`, {
        detection_idx: detectionIdx,
        hidden: isHidden
      });

      if (response.status === 200) {
        // Update local state for immediate feedback
        set((state) => ({
          potholes: state.potholes.map(p =>
            (p.upload_id === uploadId && p.id === detectionIdx)
              ? { ...p, is_hidden: isHidden }
              : p
          )
        }));
        return true;
      } else {
        const errorData = await response.data;
        alert(`Failed to update visibility: ${errorData?.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      alert(`Error updating visibility: ${error.response?.data?.detail || error.message}`);
    }
    return false;
  },

  deleteDetection: async (uploadId, detectionIdx) => {
    if (!uploadId) {
      console.error("Cannot delete: uploadId is missing");
      return false;
    }
    try {
      const { default: api } = await import('../services/api');
      const response = await api.patch(`/uploads/${uploadId}/override`, {
        detection_idx: detectionIdx,
        deleted: true
      });

      if (response.status === 200) {
        // Immediately remove from local state
        set((state) => ({
          potholes: state.potholes.filter(p => !(p.upload_id === uploadId && p.id === detectionIdx))
        }));
        return true;
      } else {
        const errorData = await response.data;
        alert(`Failed to delete: ${errorData?.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to delete detection:", error);
      alert(`Error deleting detection: ${error.response?.data?.detail || error.message}`);
    }
    return false;
  },

  resetData: () => set({
    vehicles: [],
    potholes: [],
    pavement: [],
    iriFiles: [],
    roiPolygon: null
  })
}));

export default useAppStore;
