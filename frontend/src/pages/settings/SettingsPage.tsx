import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Star } from "lucide-react";
import { hotelTypesApi, roomCategoriesApi } from "../../api/hotels.api";
import type { HotelType, RoomCategory } from "../../types";

type Tab = "hotelTypes" | "roomCategories";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("hotelTypes");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-sm text-gray-500">
          Customization lists shared by every hotel — add or retire hotel types and room categories here. NovaStay HMS runs exclusively on the Indian Rupee (₹) — there is no currency selection.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm w-fit">
        {(
          [
            ["hotelTypes", "Hotel Types"],
            ["roomCategories", "Room Categories"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === key ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "hotelTypes" && <HotelTypesPanel />}
      {tab === "roomCategories" && <RoomCategoriesPanel />}
    </div>
  );
}

function HotelTypesPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const { data, isLoading } = useQuery<HotelType[]>({
    queryKey: ["hotel-types", "all"],
    queryFn: () => hotelTypesApi.list(true),
  });

  const createMutation = useMutation({
    mutationFn: () => hotelTypesApi.create(form),
    onSuccess: () => {
      toast.success("Hotel type added");
      queryClient.invalidateQueries({ queryKey: ["hotel-types"] });
      setForm({ name: "", code: "", description: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not add hotel type"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => hotelTypesApi.delete(id),
    onSuccess: () => {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["hotel-types"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not remove"),
  });

  return (
    <PanelShell
      title="Hotel Types"
      hint="Used on the Hotel form so every property is categorized (Business, Resort, Boutique, etc). Types already in use are retired instead of deleted."
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <ItemList
          items={(data ?? []).map((t) => ({ id: t.id, primary: t.name, secondary: t.code, inactive: !t.isActive }))}
          onRemove={(id) => removeMutation.mutate(id)}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4"
      >
        <input
          placeholder="Name (e.g. Boutique Hotel)"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Code (e.g. BOUTIQUE)"
          required
          pattern="[A-Z0-9_]+"
          title="UPPER_SNAKE_CASE"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {createMutation.isPending ? "Adding…" : "Add Hotel Type"}
        </button>
      </form>
    </PanelShell>
  );
}

function RoomCategoriesPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "" });
  const { data, isLoading } = useQuery<RoomCategory[]>({
    queryKey: ["room-categories", "all"],
    queryFn: () => roomCategoriesApi.list(true),
  });

  const createMutation = useMutation({
    mutationFn: () => roomCategoriesApi.create(form),
    onSuccess: () => {
      toast.success("Room category added");
      queryClient.invalidateQueries({ queryKey: ["room-categories"] });
      setForm({ name: "", code: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not add category"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => roomCategoriesApi.delete(id),
    onSuccess: () => {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["room-categories"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not remove"),
  });

  return (
    <PanelShell
      title="Room Categories"
      hint="Used to group room types (Standard, Deluxe, Suite, Executive…) for pricing and filtering on the Rooms page."
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <ItemList
          items={(data ?? []).map((c) => ({ id: c.id, primary: c.name, secondary: c.code, inactive: !c.isActive }))}
          onRemove={(id) => removeMutation.mutate(id)}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4"
      >
        <input
          placeholder="Name (e.g. Executive)"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Code (e.g. EXECUTIVE)"
          required
          pattern="[A-Z0-9_]+"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {createMutation.isPending ? "Adding…" : "Add Room Category"}
        </button>
      </form>
    </PanelShell>
  );
}

function PanelShell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-gray-500">{hint}</p>
      {children}
    </div>
  );
}

function ItemList({
  items,
  onRemove,
}: {
  items: { id: string; primary: string; secondary?: string; inactive?: boolean }[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 ${item.inactive ? "opacity-50" : ""}`}
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{item.primary}</p>
            {item.secondary && <p className="text-xs text-gray-500">{item.secondary}</p>}
          </div>
          <button onClick={() => onRemove(item.id)} className="rounded-md bg-red-50 p-1.5 text-red-700 hover:bg-red-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-gray-400">Nothing here yet.</p>}
    </div>
  );
}
