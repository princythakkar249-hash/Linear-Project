import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Label } from "@/components/ui/ui";
import { api } from "@/lib/api";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Address search with autocomplete suggestions (OpenStreetMap data via Photon, through our backend). */
export function PlaceSearch({ id, label, color, value, onChange, near, picking, onPickToggle }: {
  id: string; label: string; color: string; value: Place | null; onChange: (p: Place | null) => void;
  near?: { lat: number; lng: number } | null; picking: boolean; onPickToggle: () => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Place[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    if (value || query.trim().length < 3) { setItems([]); setState("idle"); return; }
    const controller = new AbortController();
    const handle = setTimeout(async () => {  // debounce: one request after typing pauses
      setState("loading");
      try {
        const found = await api.geocode(query, nearRef.current ?? { lat: 23.03, lng: 72.57 }, controller.signal);
        setItems(found); setActive(0); setState(found.length ? "idle" : "empty"); setOpen(true);
      } catch (e: any) { if (e.name !== "AbortError") { setError(e.message); setState("error"); setItems([]); } }
    }, 450);
    return () => { clearTimeout(handle); controller.abort(); };
  }, [query, value]);

  const choose = (p: Place) => { onChange(p); setQuery(""); setItems([]); setOpen(false); };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {value ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-300 bg-white p-2 dark:border-navy-700 dark:bg-navy-800" data-testid={`${id}-selected`}>
          <MapPin size={18} style={{ color }} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 text-sm"><div className="truncate font-semibold">{value.label}</div><div className="truncate text-xs text-slate-500">{value.detail || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</div></div>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={`Change ${label.toLowerCase()}`}><X size={14} />Change</Button>
        </div>
      ) : (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
          <Input id={id} className="pl-9" role="combobox" aria-expanded={open && items.length > 0} aria-controls={`${id}-list`} autoComplete="off"
            placeholder="Type at least 3 letters of an address or place" value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter" && items[active]) { e.preventDefault(); choose(items[active]); }
              else if (e.key === "Escape") setOpen(false);
            }} />
          {state === "loading" && <Loader2 size={15} className="absolute right-3 top-2.5 animate-spin text-slate-400" />}
          {open && items.length > 0 && (
            <ul id={`${id}-list`} role="listbox" className="absolute z-[1100] mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-navy-700 dark:bg-navy-900">
              {items.map((p, i) => (
                <li key={`${p.lat},${p.lng},${i}`} role="option" aria-selected={i === active}>
                  <button className={cn("block w-full px-3 py-2 text-left text-sm", i === active && "bg-brand-50 dark:bg-navy-800")} onMouseEnter={() => setActive(i)} onClick={() => choose(p)}>
                    <span className="font-medium">{p.label}</span><span className="block truncate text-xs text-slate-500">{p.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state === "empty" && <p className="mt-1 text-xs text-slate-500">No places found. Try another spelling or pick on the map.</p>}
          {state === "error" && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <button className={cn("mt-1 text-xs underline", picking ? "font-semibold text-brand-700" : "text-slate-500")} onClick={onPickToggle}>
            {picking ? "Click on the map now… (cancel)" : "or pick on the map"}
          </button>
        </div>
      )}
    </div>
  );
}
