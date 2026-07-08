import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";
import { useHotelStore } from "./hotelStore";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: User, accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        // Staff assigned to a single property are always scoped to it.
        // SUPER_ADMIN has no fixed hotelId — leave whatever they last picked
        // in the hotel switcher (or null, prompting them to pick one).
        if (user.hotelId) {
          useHotelStore.getState().setSelectedHotel(user.hotelId);
        }
      },
      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null });
        useHotelStore.getState().setSelectedHotel(null);
      },
    }),
    {
      name: "novastay-auth",
      // Deliberately excludes `accessToken`: it's a short-lived bearer
      // credential that only ever needs to live in memory for the current
      // tab. Persisting it to localStorage would let any XSS payload read
      // a live credential straight off disk, including after the session
      // "should" have ended. On reload, accessToken starts null; the first
      // authenticated request 401s and the axios response interceptor
      // (api/axios.ts) silently exchanges the persisted refreshToken for a
      // fresh one — so this has no effect on the user experience.
      partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken }),
    }
  )
);
