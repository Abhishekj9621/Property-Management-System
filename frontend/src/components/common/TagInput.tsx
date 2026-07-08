import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  // Shown as one-click quick-add buttons above the input — handy for
  // amenities that come up constantly (AC/Non-AC especially).
  suggestions?: string[];
}

/** Type + Enter (or comma) to add a tag; click the × to remove one. */
export function TagInput({ value, onChange, placeholder = "Add amenity, press Enter", suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const unusedSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="col-span-2">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-300 p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
          >
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="hover:text-brand-900">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-none text-sm outline-none"
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-500 hover:border-brand-300 hover:text-brand-600"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
