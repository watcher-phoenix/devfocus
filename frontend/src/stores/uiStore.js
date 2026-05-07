import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  quickCaptureOpen: false,
  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),
  boardFilters: { projectId: null, type: null },
  setBoardFilters: (filters) => set((s) => ({ boardFilters: { ...s.boardFilters, ...filters } })),
}));

export default useUIStore;
