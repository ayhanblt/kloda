import { useEffect, useState } from "react";
import { AppIcon } from "@/shared/ui/logo";

/** Short launch animation, once per browser session. Never blocks interaction for long. */
export function IntroSplash() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (window.sessionStorage.getItem("kloda-intro")) return;
    window.sessionStorage.setItem("kloda-intro", "1");
    setShow(true);
    const id = window.setTimeout(() => setShow(false), 1700);
    return () => window.clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background intro-fade"
      aria-hidden
      onClick={() => setShow(false)}
    >
      <AppIcon animated className="size-28" />
    </div>
  );
}
