import { cn } from "@/lib/utils";

/** Bracketed matrix. `augment` draws the bar of [A|B]. Large matrices scroll inside their own box. */
export function Matrix({ data, cols, rowLabels, augment = false, highlight, className, light = false }: {
  data: string[][]; cols?: string[]; rowLabels?: string[]; augment?: boolean; highlight?: [number, number] | null; className?: string; light?: boolean;
}) {
  if (!data.length || !data[0].length) return <span className="text-sm text-slate-500">(empty)</span>;
  const n = data[0].length;
  const wide = n > 14;
  const cell = cn("shrink-0 px-1 py-0.5 text-center", wide ? "w-9" : "w-12");
  return (
    <div className={cn("inline-block max-w-full overflow-auto align-top", data.length > 20 && "max-h-[28rem]", className)}>
      <div className="inline-block">
        {cols && (
          <div className="flex pl-2 font-mono text-[11px] text-slate-400">
            {rowLabels && <span className="w-10 shrink-0" />}
            {cols.map((c, i) => <span key={i} className={cn(cell, augment && i === cols.length - 1 && "ml-2")}>{c}</span>)}
          </div>
        )}
        <div className="flex">
          {rowLabels && (
            <div className="w-10 shrink-0 py-1 font-mono text-[11px] text-slate-400">
              {rowLabels.map((l, i) => <div key={i} className="h-6 truncate pr-1 text-right leading-6" title={l}>{l}</div>)}
            </div>
          )}
          <div className={cn("flex items-stretch font-mono text-sm", light ? "text-white" : "text-navy-900 dark:text-slate-100")}>
            <div className={cn("w-2 rounded-l-md border-y-2 border-l-2 border-navy-900 dark:border-slate-300", light && "!border-slate-200")} />
            <div className="py-1">
              {data.map((row, i) => (
                <div key={i} className="flex h-6">
                  {row.map((v, j) => (
                    <span key={j} className={cn(cell, "leading-5", wide && v === "0" && "text-slate-300 dark:text-slate-600",
                      augment && j === n - 1 && "ml-2 border-l-2 border-dashed border-cyan2 pl-2",
                      highlight && highlight[0] === i && highlight[1] === j && "rounded bg-cyan2-100 font-bold text-cyan-900")}>{v}</span>
                  ))}
                </div>
              ))}
            </div>
            <div className={cn("w-2 rounded-r-md border-y-2 border-r-2 border-navy-900 dark:border-slate-300", light && "!border-slate-200")} />
          </div>
        </div>
      </div>
    </div>
  );
}
