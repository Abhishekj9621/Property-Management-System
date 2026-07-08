import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Pencil, Trash2, Settings } from "lucide-react";
import { roomsApi } from "../../api/rooms.api";
import { roomCategoriesApi } from "../../api/hotels.api";
import { Badge } from "../../components/common/Badge";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { TagInput } from "../../components/common/TagInput";
import { ImageUploadField } from "../../components/common/ImageUploadField";
import { useAuthStore } from "../../store/authStore";
import { can, MANAGE } from "../../lib/permissions";
import type { Room, RoomStatus, RoomType, RoomCategory } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const STATUS_OPTIONS: RoomStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "DIRTY",
  "CLEANING",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
];

// "AC" is deliberately first — it's what the public website reads to
// decide the AC/Non-AC badge for this room type (see backend
// public.service.ts's hasAc() amenity-matching).
const COMMON_ROOM_AMENITIES = ["AC", "TV", "Mini Bar", "Balcony", "Sea View", "WiFi"];

const emptyRoomTypeForm = {
  name: "",
  categoryId: "",
  basePrice: "",
  weekendPrice: "",
  extraBedPrice: "",
  taxPercent: "10",
  discountPercent: "0",
  minOccupancy: "1",
  maxOccupancy: "2",
  bedType: "",
  sizeSqft: "",
  amenities: [] as string[],
  images: [] as string[],
};
const emptyRoomForm = { roomTypeId: "", roomNumber: "", floor: "1", view: "", smokingAllowed: false };
const emptyBulkForm = { roomTypeId: "", floor: "1", startNumber: "101", count: "10", prefix: "" };

export default function RoomsPage() {
  useRealtimeSync(["room:status-changed", "room:created", "room:updated", "room:deleted"], ["rooms", "room-types"]);

  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [showTypesManager, setShowTypesManager] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [deletingRoomType, setDeletingRoomType] = useState<RoomType | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [roomTypeForm, setRoomTypeForm] = useState(emptyRoomTypeForm);
  const queryClient = useQueryClient();
  const canManage = can(user?.role, MANAGE);

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ["rooms", statusFilter],
    queryFn: () => roomsApi.listRooms(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: roomTypes } = useQuery<RoomType[]>({
    queryKey: ["room-types"],
    queryFn: () => roomsApi.listRoomTypes(),
    enabled: canManage,
  });

  const { data: roomCategories } = useQuery<RoomCategory[]>({
    queryKey: ["room-categories"],
    queryFn: () => roomCategoriesApi.list(),
    enabled: canManage,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => roomsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room status updated");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Update failed"),
  });

  const buildRoomTypePayload = () => ({
    name: roomTypeForm.name,
    categoryId: roomTypeForm.categoryId || undefined,
    basePrice: Number(roomTypeForm.basePrice),
    weekendPrice: roomTypeForm.weekendPrice ? Number(roomTypeForm.weekendPrice) : undefined,
    extraBedPrice: roomTypeForm.extraBedPrice ? Number(roomTypeForm.extraBedPrice) : undefined,
    taxPercent: roomTypeForm.taxPercent ? Number(roomTypeForm.taxPercent) : 10,
    discountPercent: roomTypeForm.discountPercent ? Number(roomTypeForm.discountPercent) : 0,
    minOccupancy: Number(roomTypeForm.minOccupancy) || 1,
    maxOccupancy: Number(roomTypeForm.maxOccupancy) || 2,
    bedType: roomTypeForm.bedType || undefined,
    sizeSqft: roomTypeForm.sizeSqft ? Number(roomTypeForm.sizeSqft) : undefined,
    amenities: roomTypeForm.amenities,
    images: roomTypeForm.images,
  });

  const createRoomTypeMutation = useMutation({
    mutationFn: () => roomsApi.createRoomType(buildRoomTypePayload()),
    onSuccess: (rt: RoomType) => {
      toast.success(`Room type "${rt.name}" created`);
      queryClient.invalidateQueries({ queryKey: ["room-types"] });
      setRoomTypeForm(emptyRoomTypeForm);
      setRoomForm((f) => ({ ...f, roomTypeId: rt.id }));
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create room type"),
  });

  const updateRoomTypeMutation = useMutation({
    mutationFn: () => roomsApi.updateRoomType(editingRoomType!.id, buildRoomTypePayload()),
    onSuccess: (rt: RoomType) => {
      toast.success(`Room type "${rt.name}" updated`);
      queryClient.invalidateQueries({ queryKey: ["room-types"] });
      setEditingRoomType(null);
      setRoomTypeForm(emptyRoomTypeForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not update room type"),
  });

  const deleteRoomTypeMutation = useMutation({
    mutationFn: () => roomsApi.deleteRoomType(deletingRoomType!.id),
    onSuccess: (result: { retired?: boolean }) => {
      toast.success(result?.retired ? "Room type retired (rooms using it are unaffected)" : "Room type deleted");
      queryClient.invalidateQueries({ queryKey: ["room-types"] });
      setDeletingRoomType(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not delete room type");
      setDeletingRoomType(null);
    },
  });

  const buildRoomPayload = () => ({
    roomTypeId: roomForm.roomTypeId,
    roomNumber: roomForm.roomNumber,
    floor: Number(roomForm.floor) || 1,
    view: roomForm.view || undefined,
    smokingAllowed: roomForm.smokingAllowed,
  });

  const createRoomMutation = useMutation({
    mutationFn: () => roomsApi.createRoom(buildRoomPayload()),
    onSuccess: () => {
      toast.success("Room added");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowRoomForm(false);
      setRoomForm(emptyRoomForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not add room"),
  });

  const updateRoomMutation = useMutation({
    mutationFn: () => roomsApi.updateRoom(editingRoom!.id, buildRoomPayload()),
    onSuccess: () => {
      toast.success("Room updated");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingRoom(null);
      setRoomForm(emptyRoomForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not update room"),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: () => roomsApi.deleteRoom(deletingRoom!.id),
    onSuccess: () => {
      toast.success("Room deleted");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setDeletingRoom(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not delete room");
      setDeletingRoom(null);
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: () =>
      roomsApi.bulkCreateRooms({
        roomTypeId: bulkForm.roomTypeId,
        floor: Number(bulkForm.floor) || 1,
        startNumber: Number(bulkForm.startNumber) || 1,
        count: Number(bulkForm.count) || 1,
        prefix: bulkForm.prefix || undefined,
      }),
    onSuccess: (result: { createdCount: number; skipped: string[] }) => {
      toast.success(
        result.skipped.length
          ? `Added ${result.createdCount} rooms — skipped ${result.skipped.length} that already existed (${result.skipped.join(", ")})`
          : `Added ${result.createdCount} rooms`
      );
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowBulkForm(false);
      setBulkForm(emptyBulkForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create rooms"),
  });

  const isEditingRoom = !!editingRoom;

  const openEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      roomTypeId: room.roomTypeId,
      roomNumber: room.roomNumber,
      floor: String(room.floor),
      view: room.view ?? "",
      smokingAllowed: !!room.smokingAllowed,
    });
  };

  const closeRoomModal = () => {
    setShowRoomForm(false);
    setEditingRoom(null);
    setRoomForm(emptyRoomForm);
  };

  const openEditRoomType = (rt: RoomType) => {
    setEditingRoomType(rt);
    setRoomTypeForm({
      name: rt.name,
      categoryId: rt.categoryId ?? "",
      basePrice: String(rt.basePrice),
      weekendPrice: rt.weekendPrice != null ? String(rt.weekendPrice) : "",
      extraBedPrice: rt.extraBedPrice != null ? String(rt.extraBedPrice) : "",
      taxPercent: String(rt.taxPercent ?? "10"),
      discountPercent: String(rt.discountPercent ?? "0"),
      minOccupancy: String(rt.minOccupancy ?? "1"),
      maxOccupancy: String(rt.maxOccupancy),
      bedType: rt.bedType ?? "",
      sizeSqft: rt.sizeSqft ? String(rt.sizeSqft) : "",
      amenities: rt.amenities ?? [],
      images: rt.images ?? [],
    });
  };

  const resetRoomTypeForm = () => {
    setEditingRoomType(null);
    setRoomTypeForm(emptyRoomTypeForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-sm text-gray-500">Live room-status board across your property</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {canManage && (
            <>
              <button
                onClick={() => setShowTypesManager(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" /> Room Types
              </button>
              <button
                onClick={() => setShowBulkForm(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" /> Bulk Add
              </button>
              <button
                onClick={() => setShowRoomForm(true)}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" /> Add Room
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">Loading rooms…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rooms?.map((room) => (
            <div key={room.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">#{room.roomNumber}</p>
                  <p className="text-xs text-gray-500">Floor {room.floor}</p>
                </div>
                <Badge status={room.status} />
              </div>
              <p className="mb-3 text-sm text-gray-600">{room.roomType?.name}</p>
              <select
                value={room.status}
                onChange={(e) => statusMutation.mutate({ id: room.id, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => openEditRoom(room)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => setDeletingRoom(room)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {rooms?.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-gray-400">
              No rooms found{canManage ? " — add one to get started." : "."}
            </p>
          )}
        </div>
      )}

      {(showRoomForm || isEditingRoom) && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{isEditingRoom ? "Edit Room" : "Add Room"}</h2>
              <button onClick={closeRoomModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                isEditingRoom ? updateRoomMutation.mutate() : createRoomMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Room type</label>
                <select
                  required
                  value={roomForm.roomTypeId}
                  onChange={(e) => setRoomForm({ ...roomForm, roomTypeId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a room type…</option>
                  {roomTypes?.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} — ₹{Number(rt.basePrice)}/night
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Room number"
                  required
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Floor"
                  type="number"
                  required
                  value={roomForm.floor}
                  onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="View (e.g. Sea View)"
                  value={roomForm.view}
                  onChange={(e) => setRoomForm({ ...roomForm, view: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={roomForm.smokingAllowed}
                    onChange={(e) => setRoomForm({ ...roomForm, smokingAllowed: e.target.checked })}
                  />
                  Smoking allowed
                </label>
              </div>
              <button
                type="submit"
                disabled={createRoomMutation.isPending || updateRoomMutation.isPending || !roomForm.roomTypeId}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isEditingRoom
                  ? updateRoomMutation.isPending
                    ? "Saving…"
                    : "Save Changes"
                  : createRoomMutation.isPending
                    ? "Adding…"
                    : "Add Room"}
              </button>
            </form>

            {!isEditingRoom && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  No room type yet? Create one
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createRoomTypeMutation.mutate();
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <input
                    placeholder="Type name (e.g. Deluxe King)"
                    required
                    value={roomTypeForm.name}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })}
                    className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Base price/night"
                    type="number"
                    min={0}
                    required
                    value={roomTypeForm.basePrice}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, basePrice: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Max occupancy"
                    type="number"
                    min={1}
                    value={roomTypeForm.maxOccupancy}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxOccupancy: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Bed type"
                    value={roomTypeForm.bedType}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, bedType: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Size (sqft)"
                    type="number"
                    value={roomTypeForm.sizeSqft}
                    onChange={(e) => setRoomTypeForm({ ...roomTypeForm, sizeSqft: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={createRoomTypeMutation.isPending}
                    className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {createRoomTypeMutation.isPending ? "Creating…" : "Create Room Type"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {showTypesManager && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Manage Room Types</h2>
              <button
                onClick={() => {
                  setShowTypesManager(false);
                  resetRoomTypeForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 space-y-2">
              {roomTypes?.map((rt) => (
                <div
                  key={rt.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {rt.name}
                      {rt.category?.name ? ` · ${rt.category.name}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      ₹{Number(rt.basePrice)}/night · up to {rt.maxOccupancy} guests · tax {Number(rt.taxPercent)}%
                      {Number(rt.discountPercent) > 0 ? ` · ${Number(rt.discountPercent)}% off` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditRoomType(rt)}
                      className="rounded-md bg-gray-50 p-1.5 text-gray-700 hover:bg-gray-100"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingRoomType(rt)}
                      className="rounded-md bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {roomTypes?.length === 0 && <p className="text-sm text-gray-400">No room types yet.</p>}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {editingRoomType ? `Editing "${editingRoomType.name}"` : "Create a new room type"}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  editingRoomType ? updateRoomTypeMutation.mutate() : createRoomTypeMutation.mutate();
                }}
                className="grid grid-cols-2 gap-2"
              >
                <input
                  placeholder="Type name (e.g. Deluxe King)"
                  required
                  value={roomTypeForm.name}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })}
                  className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={roomTypeForm.categoryId}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, categoryId: e.target.value })}
                  className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Category (optional)…</option>
                  {roomCategories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Base price/night"
                  type="number"
                  min={0}
                  required
                  value={roomTypeForm.basePrice}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, basePrice: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Weekend price (optional)"
                  type="number"
                  min={0}
                  value={roomTypeForm.weekendPrice}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, weekendPrice: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Extra bed price"
                  type="number"
                  min={0}
                  value={roomTypeForm.extraBedPrice}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, extraBedPrice: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Tax %"
                  type="number"
                  min={0}
                  max={100}
                  value={roomTypeForm.taxPercent}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, taxPercent: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Discount %"
                  type="number"
                  min={0}
                  max={100}
                  value={roomTypeForm.discountPercent}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, discountPercent: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Min occupancy"
                  type="number"
                  min={1}
                  value={roomTypeForm.minOccupancy}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, minOccupancy: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Max occupancy"
                  type="number"
                  min={1}
                  value={roomTypeForm.maxOccupancy}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, maxOccupancy: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Bed type"
                  value={roomTypeForm.bedType}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, bedType: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Size (sqft)"
                  type="number"
                  value={roomTypeForm.sizeSqft}
                  onChange={(e) => setRoomTypeForm({ ...roomTypeForm, sizeSqft: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    Amenities <span className="font-normal text-gray-400">(include "AC" here for the AC/Non-AC badge on the public site)</span>
                  </label>
                  <TagInput
                    value={roomTypeForm.amenities}
                    onChange={(amenities) => setRoomTypeForm({ ...roomTypeForm, amenities })}
                    suggestions={COMMON_ROOM_AMENITIES}
                    placeholder="e.g. AC, TV, Balcony — press Enter"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">Photos</label>
                  <ImageUploadField
                    value={roomTypeForm.images}
                    onChange={(images) => setRoomTypeForm({ ...roomTypeForm, images })}
                    folder="room-types"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  {editingRoomType && (
                    <button
                      type="button"
                      onClick={resetRoomTypeForm}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={createRoomTypeMutation.isPending || updateRoomTypeMutation.isPending}
                    className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {editingRoomType
                      ? updateRoomTypeMutation.isPending
                        ? "Saving…"
                        : "Save Changes"
                      : createRoomTypeMutation.isPending
                        ? "Creating…"
                        : "Create Room Type"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showBulkForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Bulk Add Rooms</h2>
              <button
                onClick={() => {
                  setShowBulkForm(false);
                  setBulkForm(emptyBulkForm);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-500">
              Provision a range of rooms on one floor at once — e.g. floor 4, starting at 401, 20 rooms creates
              401–420. Room numbers that already exist are skipped, not overwritten.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                bulkCreateMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Room type</label>
                <select
                  required
                  value={bulkForm.roomTypeId}
                  onChange={(e) => setBulkForm({ ...bulkForm, roomTypeId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a room type…</option>
                  {roomTypes?.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} — ₹{Number(rt.basePrice)}/night
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Floor</label>
                  <input
                    type="number"
                    required
                    value={bulkForm.floor}
                    onChange={(e) => setBulkForm({ ...bulkForm, floor: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">How many rooms</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={bulkForm.count}
                    onChange={(e) => setBulkForm({ ...bulkForm, count: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Starting number</label>
                  <input
                    type="number"
                    required
                    value={bulkForm.startNumber}
                    onChange={(e) => setBulkForm({ ...bulkForm, startNumber: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Prefix (optional)</label>
                  <input
                    placeholder="e.g. A-"
                    value={bulkForm.prefix}
                    onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={bulkCreateMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {bulkCreateMutation.isPending ? "Creating…" : "Create Rooms"}
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingRoom && (
        <ConfirmDialog
          title="Delete room"
          message={`Delete room #${deletingRoom.roomNumber}? Rooms that are occupied, reserved, or have active bookings can't be deleted.`}
          isLoading={deleteRoomMutation.isPending}
          onConfirm={() => deleteRoomMutation.mutate()}
          onCancel={() => setDeletingRoom(null)}
        />
      )}

      {deletingRoomType && (
        <ConfirmDialog
          title="Delete room type"
          message={`Delete "${deletingRoomType.name}"? If rooms are still assigned to it, it will be retired (hidden from pickers) instead of deleted, so existing rooms and bookings keep working.`}
          isLoading={deleteRoomTypeMutation.isPending}
          onConfirm={() => deleteRoomTypeMutation.mutate()}
          onCancel={() => setDeletingRoomType(null)}
        />
      )}
    </div>
  );
}
