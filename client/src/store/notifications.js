import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  volunteerLocation: null,
  impactStats: null,
  setImpactStats: (data) => set({ impactStats: data }),
  setVolunteerLocation: (data) => set({ volunteerLocation: data }),
  listingUpdate: null,
  setListingUpdate: (data) => set({ listingUpdate: data }),
  add: (listing) => set((state) => ({
    notifications: [{ ...listing, isUrgent: false, seenAt: Date.now() }, ...state.notifications]
  })),
  addUrgent: (listing) => set((state) => ({
    notifications: [{ ...listing, isUrgent: true, seenAt: Date.now() }, ...state.notifications]
  })),
  clear: () => set({ notifications: [] }),
  markAllRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  }))
}));
