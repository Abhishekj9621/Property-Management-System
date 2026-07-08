import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HotelState {
  /** The hotel currently "in view". For single-property staff this is
   * locked to their own hotel. For SUPER_ADMIN (no fixed hotel) this is
   * whatever they picked in the hotel switcher, and is sent as the
   * `x-hotel-id` header on every API request. */
  selectedHotelId: string | null;
  selectedHotelName: string | null;
  setSelectedHotel: (id: string | null, name?: string | null) => void;
}

export const useHotelStore = create<HotelState>()(
  persist(
    (set) => ({
      selectedHotelId: null,
      selectedHotelName: null,
      setSelectedHotel: (id, name = null) => set({ selectedHotelId: id, selectedHotelName: name }),
    }),
    { name: "novastay-hotel" }
  )
);
