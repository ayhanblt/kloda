import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Cloud, KeyRound, Lock, Plug, Server, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/shared/model/demo-store";
import { useI18n } from "@/shared/i18n";
import { Notice, Panel, SectionTitle, StatusPill, DemoBadge } from "@/shared/ui/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { providers, type Provider } from "@/entities/connection/model";

/** M7 / D9 — provider picker (shared). */
export function ProviderPicker({ base }: { base: "/m" | "/d" }) {
  const { t } = useI18n();
  const list = (kind: Provider["kind"]) => providers.filter((p) => p.kind === kind);
  return (
    <div>
      {base === "/m" && (
        <>
          <SectionTitle>{t.conn.computers}</SectionTitle>
          <Link
            to="/m/pair-pc"
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card hover:bg-accent"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground">
              <Server className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{t.conn.pairPc}</span>
              <span className="block text-xs text-muted-foreground">{t.conn.pairPcBody}</span>
            </span>
          </Link>
        </>
      )}
      {(["protocol", "cloud"] as const).map((kind) => (
        <div key={kind}>
          <SectionTitle>{kind === "protocol" ? t.conn.protocols : t.conn.clouds}</SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list(kind).map((p) => (
              <Link
                key={p.id}
                to={base === "/m" ? "/m/connections/new/$provider" : "/d/connections/new/$provider"}
                params={{ provider: p.id }}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-card transition-colors hover:bg-accent"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-ink-soft">
                  {kind === "protocol" ? <Plug className="size-4" /> : <Cloud className="size-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** P1–P5 / C1–C11 — protocol-appropriate connection form (design only). */
export function ProviderForm({ provider, base = "/m" }: { provider: Provider; base?: "/m" | "/d" }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const { demo, set } = useDemo();
  const [test, setTest] = useState<"idle" | "ok" | "fail">("idle");
  const [authMethod, setAuthMethod] = useState("authPassword");
  const targetLabel =
    provider.target === "folder"
      ? t.conn.targetFolder
      : provider.target === "bucket"
        ? t.conn.targetBucket
        : t.conn.targetServer;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge />
        <StatusPill tone="neutral">
          {t.conn.target}: {targetLabel}
        </StatusPill>
        {provider.security === "unknown" && (
          <StatusPill tone="review">{t.status.unknownSecurity}</StatusPill>
        )}
      </div>

      {provider.auth === "tbd" && (
        <Panel className="border-dashed bg-surface">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-ink-soft shadow-card">
              <KeyRound className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{t.common.integrationPoint}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.conn.authTbd}</p>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {provider.fields.map((f) => {
            const id = `${provider.id}-${f.key}`;
            if (f.type === "select")
              return (
                <fieldset key={f.key}>
                  <legend className="mb-2 text-sm font-medium text-ink">{t.conn.fields[f.key]}</legend>
                  <div className="flex flex-wrap gap-2">
                    {f.options?.map((o) => (
                      <Button variant="ghost"
                        type="button"
                        key={o}
                        aria-pressed={authMethod === o}
                        onClick={() => setAuthMethod(o)}
                        className={
                          authMethod === o
                            ? "min-h-12 rounded-xl border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground"
                            : "min-h-12 rounded-xl border border-border bg-card px-4 text-sm text-ink-soft hover:bg-accent"
                        }
                      >
                        {t.conn.fields[o]}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              );
            const secret = f.type === "secret";
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={id} className="flex items-center gap-1.5">
                  {secret && <Lock className="size-3.5 text-muted-foreground" aria-hidden />}
                  {t.conn.fields[f.key]}
                </Label>
                <Input
                  id={id}
                  type={secret ? "password" : f.type === "number" ? "number" : "text"}
                  placeholder={secret ? "••••••••" : f.placeholder}
                  disabled={secret}
                  autoComplete="off"
                  className="min-h-12 rounded-xl"
                />
                {f.type === "fingerprint" && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {t.conn.fields.hostKeyHint}
                  </p>
                )}
              </div>
            );
          })}
          {provider.id === "sftp" && <div className="space-y-1.5">
            <Label htmlFor="sftp-credential">{authMethod === "authKey" ? t.conn.sshKey : t.conn.fields.password}</Label>
            <Input id="sftp-credential" type="password" disabled placeholder="••••••••" className="min-h-12" />
            {authMethod === "authKey" && <><Label htmlFor="sftp-passphrase">{t.conn.passphrase}</Label><Input id="sftp-passphrase" type="password" disabled className="min-h-12" /></>}
            <p className="text-xs text-muted-foreground">{t.conn.secretsDisabled}</p>
          </div>}
          {provider.id === "ftp" && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">{t.conn.fields.security}</p>
              <StatusPill tone="review">{t.status.unknownSecurity}</StatusPill>
            </div>
          )}
          {provider.fields.some((f) => f.type === "secret") && (
            <p className="text-xs text-muted-foreground">{t.conn.secretsDisabled}</p>
          )}
          {provider.security === "unknown" && <Notice tone="warn">{t.conn.securityNote}</Notice>}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => setTest(test === "ok" ? "fail" : "ok")}>
              {t.conn.test}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.conn.testDemo}</p>
          {test === "ok" && <Notice tone="ok">{t.conn.testOk}</Notice>}
          {test === "fail" && <Notice tone="danger">{t.conn.testFail}</Notice>}
          <Button variant="attention" className="w-full" disabled={test !== "ok"} onClick={() => { set({ connections: demo.connections + 1 }); toast(t.conn.saved); nav({ to: base === "/m" ? "/m" : "/d/connections" }); }}><Check />{base === "/m" ? t.conn.finish : t.common.save}</Button>
        </form>
      </Panel>
    </div>
  );
}
