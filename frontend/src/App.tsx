import { BookOpen, LayoutDashboard, Menu, Network, PlusCircle, Presentation, Settings as SettingsIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { cn } from "./lib/utils";
import Dashboard, { CreateDialog } from "./pages/Dashboard";
import Settings from "./pages/Settings";

const Workspace = lazy(() => import("./pages/Workspace"));
const CreateMap = lazy(() => import("./pages/CreateMap"));
const Documentation = lazy(() => import("./pages/Documentation"));
const PresentationMode = lazy(() => import("./pages/PresentationMode"));

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/docs", label: "Project Documentation", icon: BookOpen },
  { to: "/present", label: "Presentation Mode", icon: Presentation },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/** A fresh workspace for every navigation, except when saving turns /network/new into /network/<id>. */
function WorkspaceRoute() {
  const location = useLocation();
  const instance = useRef({ seen: location.key, key: location.key });
  if (instance.current.seen !== location.key) {
    instance.current = { seen: location.key, key: location.state?.keep ? instance.current.key : location.key };
  }
  return <Workspace key={instance.current.key} />;
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); setCreating(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);

  if (loc.pathname === "/present") return <Suspense fallback={null}><PresentationMode /></Suspense>;
  return (
    <div className="flex min-h-screen">
      <aside className={cn("fixed inset-y-0 left-0 z-[1150] flex h-dvh w-60 max-w-[85vw] flex-col bg-navy-900 text-slate-200 transition-transform lg:sticky lg:top-0 lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan2 text-white"><Network size={20} /></div>
          <div className="leading-tight"><div className="text-base font-bold text-white">FlowMatrix</div><div className="text-[11px] text-cyan2-400">Traffic Flow Network Analyzer</div></div>
        </div>
        <button className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600" onClick={() => { setOpen(false); setCreating(true); }}>
          <PlusCircle size={17} />New network
        </button>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
              className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", isActive ? "bg-navy-700 text-white" : "hover:bg-navy-800")}>
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-[1140] bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-navy-700 dark:bg-navy-900 lg:hidden">
          <button aria-label="Open menu" aria-expanded={open} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setOpen(true)}><Menu /></button>
          <span className="font-semibold">FlowMatrix</span>
        </header>
        <main className="mx-auto max-w-7xl p-3 sm:p-5 lg:p-7 2xl:max-w-[1600px]">
          <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/create/map" element={<CreateMap />} />
              <Route path="/network/:id" element={<WorkspaceRoute />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
