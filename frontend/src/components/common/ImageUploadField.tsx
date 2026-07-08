import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { uploadsApi } from "../../api/uploads.api";

interface ImageUploadFieldProps {
  value: string[];
  onChange: (images: string[]) => void;
  folder: "hotels" | "room-types";
}

/** Thumbnail grid + an upload button that pushes straight to R2 via the backend. */
export function ImageUploadField({ value, onChange, folder }: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    try {
      const urls = await uploadsApi.uploadImages(folder, Array.from(fileList));
      onChange([...value, ...urls]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Upload failed — check R2 is configured on the backend.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="col-span-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="text-[9px]">{isUploading ? "Uploading" : "Add photo"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
