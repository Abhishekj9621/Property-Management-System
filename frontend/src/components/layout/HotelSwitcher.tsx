import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hotelsApi } from "../../api/hotels.api";
import { useHotelStore } from "../../store/hotelStore";
import type { Hotel } from "../../types";

export function HotelSwitcher() {
  const { selectedHotelId, selectedHotelName, setSelectedHotel } = useHotelStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: hotels, isLoading } = useQuery<Hotel[]>({
    queryKey: ["hotels"],
    queryFn: () => hotelsApi.list(),
  });

  // Auto-select the first hotel if nothing is chosen yet, so SUPER_ADMIN
  // doesn't land on a blank/error state right after logging in.
  useEffect(() => {
    if (!selectedHotelId && hotels && hotels.length > 0) {
      setSelectedHotel(hotels[0].id, hotels[0].name);
    }
  }, [hotels, selectedHotelId, setSelectedHotel]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (hotel: Hotel) => {
    setSelectedHotel(hotel.id, hotel.name);
    setOpen(false);
    // Every hotel-scoped query needs to refetch under the new hotel context.
    queryClient.invalidateQueries();
  };

  return (
    <div ref={ref} className="relative px-3 pb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-100"
      >
        <Building2 className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
          {isLoading ? "Loading hotels…" : selectedHotelName ?? "Select a hotel"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && hotels && (
        <div className="absolute left-3 right-3 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {hotels.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No hotels yet.</p>
          ) : (
            hotels.map((hotel) => (
              <button
                key={hotel.id}
                onClick={() => handleSelect(hotel)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="min-w-0 truncate">
                  <span className="block truncate font-medium text-gray-800">{hotel.name}</span>
                  <span className="block truncate text-xs text-gray-400">{hotel.city}, {hotel.country}</span>
                </span>
                {hotel.id === selectedHotelId && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
