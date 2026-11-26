/* shadcn/ui-style primitives (hand-written, same conventions: cva variants + cn()). */
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, useContext, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-brand-700 text-white hover:bg-brand-600",
        secondary: "bg-slate-100 text-navy-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100",
        outline: "border border-slate-300 bg-white hover:bg-slate-50 text-navy-900 dark:bg-transparent dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800",
        destructive: "bg-red-600 text-white hover:bg-red-500",
      },
      size: { default: "h-9 px-4", sm: "h-8 px-3 text-xs", lg: "h-11 px-6", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({ className, variant, size, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant, size }), className)} {...p} />;
}

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) =>
  <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-card dark:bg-navy-900 dark:border-navy-700", className)} {...p} />;
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn("px-5 pt-5 pb-2", className)} {...p} />;
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("font-semibold text-navy-900 dark:text-white", className)} {...p} />;
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn("px-5 pb-5", className)} {...p} />;

const badge = cva("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: { tone: {
    neutral: "bg-slate-100 text-slate-700", blue: "bg-brand-100 text-brand-700", cyan: "bg-cyan2-100 text-cyan-800",
    green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800" } },
  defaultVariants: { tone: "neutral" },
});
export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) =>
  <span className={cn(badge({ tone }), className)} {...p} />;

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) =>
  <input className={cn("h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-navy-800 dark:border-navy-700 dark:text-white", className)} {...p} />;
export const Label = ({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) =>
  <label className={cn("mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300", className)} {...p} />;

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "warn" | "ok"; children: ReactNode }) {
  const t = { info: "bg-brand-50 border-brand-100 text-navy-900", error: "bg-red-50 border-red-200 text-red-800",
    warn: "bg-amber-50 border-amber-200 text-amber-900", ok: "bg-emerald-50 border-emerald-200 text-emerald-900" }[tone];
  return <div role={tone === "error" ? "alert" : undefined} className={cn("rounded-xl border px-4 py-3 text-sm", t)}>{children}</div>;
}

/* Tabs */
const TabCtx = createContext<{ v: string; set: (v: string) => void }>({ v: "", set: () => {} });
export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: ReactNode; className?: string }) {
  const [v, set] = useState(defaultValue);
  return <TabCtx.Provider value={{ v, set }}><div className={className}>{children}</div></TabCtx.Provider>;
}
export const TabsList = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) =>
  <div role="tablist" className={cn("mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-navy-800", className)} {...p} />;
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { v, set } = useContext(TabCtx);
  return <button role="tab" aria-selected={v === value} onClick={() => set(value)}
    className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition", v === value ? "bg-white text-brand-700 shadow-sm dark:bg-navy-700 dark:text-white" : "text-slate-600 hover:text-navy-900 dark:text-slate-300")}>{children}</button>;
}
export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const { v } = useContext(TabCtx);
  return v === value ? <div role="tabpanel">{children}</div> : null;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
