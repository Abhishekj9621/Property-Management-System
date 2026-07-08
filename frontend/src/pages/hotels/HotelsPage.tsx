import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, MapPin, Phone, Mail, X, Pencil, Trash2, RotateCcw, Star, AlertTriangle, Globe } from "lucide-react";
import { hotelsApi, hotelTypesApi } from "../../api/hotels.api";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { TagInput } from "../../components/common/TagInput";
import { ImageUploadField } from "../../components/common/ImageUploadField";
import { WebsiteListingModal } from "../../components/hotels/WebsiteListingModal";
import { useAuthStore } from "../../store/authStore";
import { useHotelStore } from "../../store/hotelStore";
import { can, HOTEL_CREATORS, HOTEL_MANAGERS } from "../../lib/permissions";
import type { Hotel, HotelType } from "../../types";

const COMMON_AMENITIES = ["AC", "WiFi", "Parking", "Pool", "Private Rooms", "Kitchen", "Breakfast Included"];

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  phone: "",
  email: "",
  hotelTypeId: "",
  starRating: "3",
  amenities: [] as string[],
  images: [] as string[],
};

type Tab = "active" | "inactive" | "all";

export default function HotelsPage() {
  const { user } = useAuthStore();
  const { selectedHotelId, setSelectedHotel } = useHotelStore();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<Tab>("active");
  const [showForm, setShowForm] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [deletingHotel, setDeletingHotel] = useState<Hotel | null>(null);
  const [permanentDeleteHotel, setPermanentDeleteHotel] = useState<Hotel | null>(null);
  const [websiteListingHotel, setWebsiteListingHotel] = useState<Hotel | null>(null);
  const [form, setForm] = useState(emptyForm);
  // When a create fails specifically because the slug belongs to a
  // deactivated hotel, we offer a one-click "restore & reuse" action
  // instead of just showing an error toast and leaving the user stuck.
  const [slugConflict, setSlugConflict] = useState(false);

  const { data: hotels, isLoading } = useQuery<Hotel[]>({
    queryKey: ["hotels", isSuperAdmin ? tab : "active"],
    queryFn: () => hotelsApi.list(isSuperAdmin ? { status: tab } : { status: "active" }),
  });

  const { data: hotelTypes } = useQuery<HotelType[]>({
    queryKey: ["hotel-types"],
    queryFn: () => hotelTypesApi.list(),
  });

  const buildPayload = (reactivateIfInactive = false) => ({
    name: form.name,
    slug: form.slug,
    description: form.description || undefined,
    address: form.address,
    city: form.city,
    state: form.state,
    country: form.country,
    postalCode: form.postalCode,
    phone: form.phone,
    email: form.email,
    hotelTypeId: form.hotelTypeId || undefined,
    starRating: form.starRating ? Number(form.starRating) : undefined,
    amenities: form.amenities,
    images: form.images,
    reactivateIfInactive,
  });

  const createMutation = useMutation({
    mutationFn: (reactivateIfInactive: boolean) => hotelsApi.create(buildPayload(reactivateIfInactive)),
    onSuccess: (hotel) => {
      toast.success(`${hotel.name} ${hotel.isActive ? "created" : "created"}`);
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      setShowForm(false);
      setForm(emptyForm);
      setSlugConflict(false);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? "Could not create hotel";
      // This is exactly the bug users hit after deleting all demo hotels:
      // the slug is still reserved by the deactivated record. Surface a
      // clear recovery path instead of a dead end.
      if (message.toLowerCase().includes("deactivated hotel already uses")) {
        setSlugConflict(true);
      } else {
        toast.error(message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => hotelsApi.update(editingHotel!.id, buildPayload()),
    onSuccess: (hotel) => {
      toast.success(`${hotel.name} updated`);
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      setEditingHotel(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not update hotel"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => hotelsApi.delete(deletingHotel!.id),
    onSuccess: () => {
      toast.success("Hotel deactivated. Its slug and history are preserved — restore it any time from the Inactive tab.");
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      setDeletingHotel(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not deactivate hotel");
      setDeletingHotel(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => hotelsApi.restore(id),
    onSuccess: (hotel) => {
      toast.success(`${hotel.name} restored`);
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not restore hotel"),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => hotelsApi.permanentlyDelete(permanentDeleteHotel!.id),
    onSuccess: () => {
      toast.success("Hotel permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
      setPermanentDeleteHotel(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not permanently delete hotel");
      setPermanentDeleteHotel(null);
    },
  });

  const canCreate = can(user?.role, HOTEL_CREATORS);
  const canEdit = can(user?.role, HOTEL_MANAGERS);
  const isEditing = !!editingHotel;

  const openEdit = (hotel: Hotel) => {
    setEditingHotel(hotel);
    setForm({
      name: hotel.name,
      slug: hotel.slug,
      description: hotel.description ?? "",
      address: hotel.address,
      city: hotel.city,
      state: hotel.state,
      country: hotel.country,
      postalCode: hotel.postalCode,
      phone: hotel.phone,
      email: hotel.email,
      hotelTypeId: hotel.hotelTypeId ?? "",
      starRating: hotel.starRating ? String(hotel.starRating) : "3",
      amenities: hotel.amenities ?? [],
      images: hotel.images ?? [],
    });
  };

  const closeModals = () => {
    setShowForm(false);
    setEditingHotel(null);
    setForm(emptyForm);
    setSlugConflict(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hotels</h1>
          <p className="text-sm text-gray-500">Properties in your NovaStay portfolio</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Hotel
          </button>
        )}
      </div>

      {isSuperAdmin && (
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm w-fit">
          {(["active", "inactive", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                tab === t ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">Loading hotels…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels?.map((hotel) => (
            <div
              key={hotel.id}
              className={`rounded-xl border bg-white p-5 shadow-sm ${
                !hotel.isActive
                  ? "border-gray-200 opacity-70"
                  : hotel.id === selectedHotelId
                    ? "border-brand-400 ring-1 ring-brand-200"
                    : "border-gray-200"
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{hotel.name}</h2>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                    {hotel.hotelType?.name && <span>{hotel.hotelType.name}</span>}
                    {hotel.starRating ? (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {hotel.starRating}
                      </span>
                    ) : null}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">₹ INR</span>
                  </div>
                </div>
                {!hotel.isActive ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                ) : hotel.id === selectedHotelId ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Active</span>
                ) : null}
              </div>
              {hotel.description && <p className="mb-3 text-xs text-gray-500 line-clamp-2">{hotel.description}</p>}
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>
                    {hotel.address}, {hotel.city}, {hotel.state}, {hotel.country}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>{hotel.phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>{hotel.email}</span>
                </div>
              </div>
              {hotel.amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {hotel.amenities.slice(0, 4).map((a) => (
                    <span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {a}
                    </span>
                  ))}
                </div>
              )}
              {hotel.isActive && isSuperAdmin && hotel.id !== selectedHotelId && (
                <button
                  onClick={() => setSelectedHotel(hotel.id, hotel.name)}
                  className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Switch to this hotel
                </button>
              )}
              {hotel.isActive && canEdit && (
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => openEdit(hotel)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => setWebsiteListingHotel(hotel)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                  >
                    <Globe className="h-3 w-3" /> Website
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setDeletingHotel(hotel)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" /> Deactivate
                    </button>
                  )}
                </div>
              )}
              {!hotel.isActive && isSuperAdmin && (
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => restoreMutation.mutate(hotel.id)}
                    disabled={restoreMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                  <button
                    onClick={() => setPermanentDeleteHotel(hotel)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" /> Delete permanently
                  </button>
                </div>
              )}
            </div>
          ))}
          {hotels?.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-gray-400">
              No {tab !== "active" ? tab : ""} hotels{tab === "active" ? " yet" : ""}.
            </p>
          )}
        </div>
      )}

      {(showForm || isEditing) && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{isEditing ? "Edit Hotel" : "Add Hotel"}</h2>
              <button onClick={closeModals} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {slugConflict && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">
                    A deactivated hotel already uses the slug "{form.slug}".
                  </p>
                  <p className="mt-1">
                    You can restore &amp; overwrite it with these details, or change the slug above and try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate(true)}
                    className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Restore &amp; reuse this slug
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                isEditing ? updateMutation.mutate() : createMutation.mutate(false);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <input
                placeholder="Hotel name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="slug (e.g. novastay-beach)"
                required
                disabled={isEditing}
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers, and hyphens only"
                value={form.slug}
                onChange={(e) => {
                  setSlugConflict(false);
                  setForm({ ...form, slug: e.target.value });
                }}
                className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              />
              <textarea
                placeholder="Short description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
              <select
                value={form.hotelTypeId}
                onChange={(e) => setForm({ ...form, hotelTypeId: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Hotel type…</option>
                {hotelTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={form.starRating}
                onChange={(e) => setForm({ ...form, starRating: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <input
                placeholder="Address"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="City"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="State"
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Country"
                required
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Postal code"
                required
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Amenities</label>
                <TagInput
                  value={form.amenities}
                  onChange={(amenities) => setForm({ ...form, amenities })}
                  suggestions={COMMON_AMENITIES}
                  placeholder="e.g. AC, WiFi, Parking — press Enter"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Photos</label>
                <ImageUploadField value={form.images} onChange={(images) => setForm({ ...form, images })} folder="hotels" />
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="col-span-2 mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isEditing
                  ? updateMutation.isPending
                    ? "Saving…"
                    : "Save Changes"
                  : createMutation.isPending
                    ? "Creating…"
                    : "Create Hotel"}
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingHotel && (
        <ConfirmDialog
          title="Deactivate hotel"
          message={`Deactivate ${deletingHotel.name}? It will be hidden from the active portfolio. Historical bookings, guests, and rooms are kept, and you can restore it any time from the Inactive tab.`}
          confirmLabel="Deactivate"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setDeletingHotel(null)}
        />
      )}

      {permanentDeleteHotel && (
        <ConfirmDialog
          title="Permanently delete hotel"
          message={`This can't be undone. "${permanentDeleteHotel.name}" will be permanently erased. This only works if it has no bookings, guests, or staff on record — otherwise, keep it deactivated instead.`}
          confirmLabel="Delete permanently"
          isLoading={permanentDeleteMutation.isPending}
          onConfirm={() => permanentDeleteMutation.mutate()}
          onCancel={() => setPermanentDeleteHotel(null)}
        />
      )}

      {websiteListingHotel && <WebsiteListingModal hotel={websiteListingHotel} onClose={() => setWebsiteListingHotel(null)} />}
    </div>
  );
}
