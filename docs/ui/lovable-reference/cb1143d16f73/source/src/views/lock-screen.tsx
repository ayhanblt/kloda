import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, BatteryFull, Camera, Check, ChevronDown, ChevronUp, Flashlight, LockKeyhole, Monitor, Pause, Play, RotateCcw, ShieldCheck, Signal, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangSwitch } from "@/features/lang-switch/ui";
import { useI18n } from "@/shared/i18n";
import { AppIcon, LogoSymbol } from "@/shared/ui/logo";
import { DemoBadge, Segmented } from "@/shared/ui/kit";
import wallpaper from "@/assets/lock-screen-wallpaper.jpg";

type TransferState = "active" | "paused" | "waiting" | "done";

export function LockScreenView() {
  const { t } = useI18n();
  const l = t.lockScreen;
  const [state, setState] = useState<TransferState>("active");
  const [expanded, setExpanded] = useState(true);
  const completed = state === "done";
  const label = completed ? l.finished : state === "active" ? l.backup : l[state];
  const detail = completed ? l.verified : state === "paused" ? l.pausedBody : state === "waiting" ? l.waitingBody : l.remaining;
  const toggle = () => setState(state === "active" ? "paused" : "active");
  const progress = completed ? "w-full bg-signal" : "w-[68%] bg-lock-accent";

  function ActivityCard({ android = false }: { android?: boolean }) {
    return (
      <section aria-label={android ? l.android : l.ios} className={android ? "rounded-[28px] bg-background/95 p-5 text-ink shadow-float backdrop-blur-xl" : "rounded-[28px] bg-lock-card/95 p-5 text-lock-text shadow-float backdrop-blur-xl"}>
        <div className="flex items-center gap-2.5">
          <AppIcon className="size-8" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Kloda</p><p className={android ? "text-[10px] text-muted-foreground" : "text-[10px] text-lock-muted"}>{l.live}</p></div>
          {android ? <Button variant="ghost" size="icon" className="size-8 min-h-8 rounded-full" aria-label={expanded ? l.collapse : l.expand} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp /> : <ChevronDown />}</Button> : <span className="rounded-full bg-lock-track px-2 py-1 text-xs font-semibold tabular-nums">{completed ? "100%" : "68%"}</span>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold leading-snug">{label}</h3>
          {completed ? <Check className="size-5 shrink-0 text-signal" /> : state === "active" ? <LogoSymbol spinning className="size-9 shrink-0" tone={android ? "dark" : "light"} /> : <Pause className="size-5 shrink-0" />}
        </div>
        <div role="progressbar" aria-label={l.backup} aria-valuenow={completed ? 100 : 68} aria-valuemin={0} aria-valuemax={100} className={android ? "mt-3 h-1.5 overflow-hidden rounded-full bg-border" : "mt-3 h-1.5 overflow-hidden rounded-full bg-lock-track"}><div className={`h-full rounded-full transition-all duration-700 ${progress}`} /></div>
        <div className={`mt-2 flex justify-between gap-2 text-[11px] tabular-nums ${android ? "text-ink-soft" : "text-lock-muted"}`}><span>{completed ? l.completeItems : l.items}</span><span>{android ? completed ? "100%" : "68%" : state === "active" ? l.remaining : l[state]}</span></div>
        {(!android || expanded) && <>
          <div className={`mt-4 border-t pt-3 ${android ? "border-border" : "border-lock-track"}`}>
            <p className="flex items-center gap-1.5 text-xs font-medium"><Monitor className="size-3.5" />{l.destination}</p>
            <p className={`mt-1 text-[11px] leading-relaxed ${android ? "text-ink-soft" : "text-lock-muted"}`}>{state === "active" ? l.network : detail}</p>
          </div>
          <div className="mt-4 flex gap-2">
            {!completed && <Button variant={android ? "secondary" : "outline"} size="sm" className={android ? "min-h-9 flex-1 rounded-full px-3" : "min-h-9 flex-1 rounded-full border-lock-track bg-lock-track text-lock-text hover:bg-lock-track/80 hover:text-lock-text"} onClick={toggle}>{state === "active" ? <Pause /> : <Play />}{state === "active" ? l.pause : l.resume}</Button>}
            <Button variant={android ? "default" : "attention"} size="sm" className="min-h-9 flex-1 rounded-full px-3" asChild><Link to="/m/activity">{l.open}<ArrowUpRight /></Link></Button>
          </div>
        </>}
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5"><Button variant="ghost" size="sm" asChild><Link to="/m/activity"><ArrowLeft />{t.nav.activity}</Link></Button><div className="flex items-center gap-3"><DemoBadge /><LangSwitch /></div></header>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs text-muted-foreground">{l.demo}</p><h1 className="text-3xl font-semibold">{l.title}</h1></div><Button variant="outline" size="icon" title={l.restart} aria-label={l.restart} onClick={() => { setState("active"); setExpanded(true); }}><RotateCcw /></Button></div>
      <Segmented label={l.title} value={state} onChange={setState} options={(["active", "paused", "waiting", "done"] as const).map(id => ({ id, label: l[id] }))} />
      <div className="mt-8 grid justify-items-center gap-x-12 gap-y-10 md:grid-cols-2">
        {([false, true] as const).map(android => <section key={String(android)} className="w-full max-w-[360px] min-w-0">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{android ? l.android : l.ios}</h2><span className="text-[10px] text-muted-foreground">{t.common.demo}</span></div>
          <div className="relative isolate flex h-[740px] w-full flex-col overflow-hidden rounded-[42px] border-[5px] border-brand bg-brand text-lock-text shadow-icon">
            <img src={wallpaper} alt="" width={1024} height={1536} className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="flex h-12 shrink-0 items-center justify-between px-6 text-[10px]"><span>19:50</span>{!android && <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-brand" />}<div className="flex gap-1.5"><Signal className="size-3.5" /><Wifi className="size-3.5" /><BatteryFull className="size-4" /></div></div>
            <div className="mt-5 flex flex-col items-center"><LockKeyhole className="mb-4 size-5" /><p className="text-sm font-medium">{l.date}</p><p className={android ? "mt-2 text-[82px] font-light leading-none tabular-nums" : "mt-1 text-[82px] font-semibold leading-none tabular-nums"}>19:50</p></div>
            {android && <div className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-lock-card/80 px-3 py-1.5 text-[11px]"><AppIcon className="size-4" /><span>{l.live}</span><span className="text-lock-accent">{completed ? "100%" : "68%"}</span></div>}
            <div className={android ? "mx-3 mt-7" : "mx-3 mt-10"}><ActivityCard android={android} /></div>
            <p className="mx-auto mt-4 flex max-w-[90%] items-center justify-center gap-1.5 rounded-full bg-lock-card/80 px-3 py-1.5 text-[10px] text-lock-text"><ShieldCheck className="size-3 shrink-0" />{l.privacy}</p>
            <div className="mt-auto px-6 pb-6"><div className="mb-6 flex justify-between"><span className="grid size-11 place-items-center rounded-full bg-lock-card/70"><Flashlight className="size-5" /></span><span className="grid size-11 place-items-center rounded-full bg-lock-card/70"><Camera className="size-5" /></span></div><p className="text-center text-[10px]">{l.swipe}</p><div className="mx-auto mt-3 h-1 w-24 rounded-full bg-lock-text" /></div>
          </div>
          {!android && <div className="mt-5"><p className="mb-2 text-xs text-muted-foreground">{l.compact}</p><div className="mx-auto flex h-11 w-48 items-center justify-between rounded-full bg-lock-card px-4 text-lock-text"><LogoSymbol className="size-8" spinning={state === "active"} /><span className="text-xs font-semibold tabular-nums text-lock-accent">{completed ? "100%" : "68%"}</span></div></div>}
        </section>)}
      </div>
    </main>
  );
}