import { Languages } from "lucide-react";
import { LANGS, useI18n } from "@/shared/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t.common.language} className="min-h-12 min-w-12">
          <Languages aria-hidden />
          <span className="uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => setLang(l.id)} className="min-h-10">
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
