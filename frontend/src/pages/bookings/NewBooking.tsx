import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { roomsApi } from "../../api/rooms.api";
import { bookingsApi } from "../../api/bookings.api";

export default function NewBooking() {
  const navigate = useNavigate();
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [results, setResults] = useState<any[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const searchMutation = useMutation({
    mutationFn: () => roomsApi.searchAvailability(checkInDate, checkOutDate, adults),
    onSuccess: (data) => {
      setResults(data);
      setSelectedRoomIds([]);
      if (data.length === 0) toast("No rooms available for these dates", { icon: "ℹ️" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Search failed"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        guest,
        checkInDate,
        checkOutDate,
        adults,
        children: 0,
        roomIds: selectedRoomIds,
        source: "DIRECT",
      }),
    onSuccess: (booking) => {
      toast.success(`Booking ${booking.bookingRef} created`);
      navigate("/bookings");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Booking failed"),
  });

  const toggleRoom = (id: string) => {
    setSelectedRoomIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const canSubmit =
    checkInDate && checkOutDate && selectedRoomIds.length > 0 && guest.firstName && guest.lastName && guest.email && guest.phone;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Booking</h1>
        <p className="text-sm text-gray-500">Search availability and create a reservation</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">1. Search Availability</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Check-in</label>
            <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Check-out</label>
            <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Adults</label>
            <input type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <button
          onClick={() => searchMutation.mutate()}
          disabled={!checkInDate || !checkOutDate || searchMutation.isPending}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {searchMutation.isPending ? "Searching…" : "Search Rooms"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">2. Select Rooms</h2>
          <div className="space-y-4">
            {results.map((r) => (
              <div key={r.roomType.id}>
                <p className="mb-2 text-sm font-medium text-gray-800">
                  {r.roomType.name} — ₹{Number(r.roomType.basePrice)}/night ({r.availableCount} available)
                </p>
                <div className="flex flex-wrap gap-2">
                  {r.availableRooms.map((room: any) => (
                    <button
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        selectedRoomIds.includes(room.id)
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Room {room.roomNumber}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedRoomIds.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">3. Guest Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="First name" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Last name" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Email" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Phone" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Confirm Booking"}
          </button>
        </div>
      )}
    </div>
  );
}
