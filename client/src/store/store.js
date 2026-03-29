import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('fb_user')) || null,
  token: localStorage.getItem('fb_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('fb_token', token);
    localStorage.setItem('fb_user', JSON.stringify(user));
    set({ user, token });
  },
  updateUser: (updatedUser) => {
    localStorage.setItem('fb_user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },
  logout: () => {
    localStorage.removeItem('fb_token');
    localStorage.removeItem('fb_user');
    set({ user: null, token: null });
  }
}));
