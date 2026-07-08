import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { X, Globe } from "lucide-react";
import { websiteListingApi } from "../../api/hotels.api";
import type { Hotel, WebsiteListing } from "../../types";

const PLATFORM_NAMES = ["Airbnb", "Booking.com", "MakeMyTrip", "Agoda"];

interface Props {
  hotel: Hotel;
  onClose: () => void;
}

export function WebsiteListingModal({ hotel, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data: listing, isLoading } = useQuery<WebsiteListing>({
    queryKey: ["website-listing", hotel.id],
    queryFn: () => websiteListingApi.get(hotel.id),
  });

  const [form, setForm] = useState<{
    isPublished: boolean;
    rating: string;
    reviewCount: string;
    platformLinks: Record<string, string>;
  }>({ isPublished: false, rating: "", reviewCount: "0", platformLinks: {} });

  useEffect(() => {
    if (listing) {
      setForm({
        isPublished: listing.isPublished,
        rating: listing.rating !== null ? String(listing.rating) : "",
        reviewCount: String(listing.reviewCount ?? 0),
        platformLinks: listing.platformLinks ?? {},
      });
    }
  }, [listing]);

  const saveMutation = useMutation({
    mutationFn: () =>
      websiteListingApi.upsert(hotel.id, {
        isPublished: form.isPublished,
        rating: form.rating ? Number(form.rating) : null,
        reviewCount: Number(form.reviewCount) || 0,
        platformLinks: form.platformLinks,
      }),
    onSuccess: () => {
      toast.success(form.isPublished ? `${hotel.name} is now live on curatdconcepts.com` : "Saved — hidden from the public site");
      queryClient.invalidateQueries({ queryKey: ["website-listing", hotel.id] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not save website listing"),
  });

  const missingPhotos = hotel.images.length === 0;
  const missingRooms = (hotel._count?.rooms ?? 0) === 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Globe className="h-5 w-5 text-brand-600" /> Website Listing — {hotel.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Photos, room types, amenities, and AC/Non-AC always come live from this hotel's own record — nothing to
              duplicate here. This is just what curatdconcepts.com doesn't otherwise know: whether to show it at all,
              and your real rating/review numbers from the booking platforms.
            </p>

            {(missingPhotos || missingRooms) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {missingPhotos && <p>⚠ This hotel has no photos yet — add some on the Edit Hotel form before publishing.</p>}
                {missingRooms && <p>⚠ This hotel has no room types yet — the public listing will look empty.</p>}
              </div>
            )}

            <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-900">Published — visible on curatdconcepts.com</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Rating (0–5)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  placeholder="e.g. 4.8"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Review count</label>
                <input
                  type="number"
                  min={0}
                  value={form.reviewCount}
                  onChange={(e) => setForm({ ...form, reviewCount: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">OTA / booking platform links</label>
              <div className="space-y-2">
                {PLATFORM_NAMES.map((platform) => (
                  <div key={platform} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-gray-600">{platform}</span>
                    <input
                      type="url"
                      value={form.platformLinks[platform] ?? ""}
                      onChange={(e) => setForm({ ...form, platformLinks: { ...form.platformLinks, [platform]: e.target.value } })}
                      placeholder="https://..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
