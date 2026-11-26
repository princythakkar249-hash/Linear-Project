import { useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/ui";
import { DOCS } from "@/content/docs";
import { VIVA, type Level } from "@/content/viva";

const TONE: Record<Level, "green" | "amber" | "red"> = { Beginner: "green", Intermediate: "amber", Advanced: "red" };

function Viva() {
  const [filter, setFilter] = useState<Level | "All">("All");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(["All", "Beginner", "Intermediate", "Advanced"] as const).map((l) => (
          <button key={l} onClick={() => setFilter(l)} aria-pressed={filter === l}
            className={`rounded-full px-3 py-1 text-sm ${filter === l ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-200"}`}>{l}</button>))}
      </div>
      {VIVA.map((c) => {
        const items = c.items.filter((i) => filter === "All" || i.level === filter);
        if (!items.length) return null;
        return (
          <Card key={c.name}><CardHeader><CardTitle>{c.name}</CardTitle></CardHeader><CardContent className="space-y-2">
            {items.map((i, k) => (
              <details key={k} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-navy-700">
                <summary className="cursor-pointer text-sm font-medium"><Badge tone={TONE[i.level]} className="mr-2">{i.level}</Badge>{i.q}</summary>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{i.a}</p>
              </details>))}
          </CardContent></Card>
        );
      })}
    </div>
  );
}

export default function Documentation() {
  return (
    <>
      <PageHeader title="Project Documentation" subtitle="Documentation of the implemented system, plus viva preparation." />
      <Tabs defaultValue="docs">
        <TabsList><TabsTrigger value="docs">Documentation</TabsTrigger><TabsTrigger value="viva">Viva preparation</TabsTrigger></TabsList>
        <TabsContent value="docs">
          <label className="mb-4 block lg:hidden"><span className="mb-1 block text-xs font-medium text-slate-600">Jump to section</span>
            <select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 dark:bg-navy-800" defaultValue="" onChange={(e) => e.target.value && document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth" })}>
              <option value="">Choose…</option>{DOCS.map((d, i) => <option key={d.title} value={`doc-${i}`}>{i + 1}. {d.title}</option>)}</select></label>
          <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
            <nav className="hidden lg:block"><ul className="sticky top-4 max-h-[calc(100dvh-2rem)] space-y-1 overflow-y-auto text-sm">
              {DOCS.map((d, i) => <li key={d.title}><a className="text-slate-600 hover:text-brand-700 dark:text-slate-300" href={`#doc-${i}`}>{i + 1}. {d.title}</a></li>)}</ul></nav>
            <div className="min-w-0 space-y-4">
              {DOCS.map((d, i) => (
                <Card key={d.title} id={`doc-${i}`}><CardHeader><CardTitle>{i + 1}. {d.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {d.body.map((p, k) => <p key={k}>{p}</p>)}
                    {d.images?.map((img) => (
                      <figure key={img.src} className="pt-2">
                        <img src={img.src} alt={img.caption} loading="lazy" className="w-full rounded-lg border border-slate-200 dark:border-navy-700" />
                        <figcaption className="mt-1 text-xs text-slate-500">{img.caption}</figcaption>
                      </figure>))}
                  </CardContent></Card>))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="viva"><Viva /></TabsContent>
      </Tabs>
    </>
  );
}
