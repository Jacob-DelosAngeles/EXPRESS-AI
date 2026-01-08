import { create } from 'zustand';

const useAppStore = create((set) => ({
  // Map Data
  vehicles: [],
  potholes: [],
  pavement: [],
  iriFiles: [], // Array of { id, filename, segments, stats, visible, color }
  potholeFiles: [], // Array of { id, filename, data, visible }

  // UI State
  activeLayers: {
    vehicles: true,
    potholes: true,
    pavement: true,
    iri: true // Global toggle for all IRI files
  },

  // Map State
  mapStyle: 'Google Hybrid',

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

  resetData: () => set({
    vehicles: [],
    potholes: [],
    pavement: [],
    iriFiles: []
  })
}));

export default useAppStore;
