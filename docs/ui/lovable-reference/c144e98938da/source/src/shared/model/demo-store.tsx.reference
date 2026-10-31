import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Demo-only prototype state. Nothing here performs real pairing, access or upload. */
export type DemoState = {
  mobileSetupDone: boolean;
  photoPermission: "unknown" | "granted" | "limited" | "denied";
  sourcesSelected: boolean;
  pcPaired: boolean;
  pcAccessGranted: boolean;
  connections: number;
  paused: boolean;
  desktopFolder: string | null;
};

const initial: DemoState = {
  mobileSetupDone: false,
  photoPermission: "unknown",
  sourcesSelected: false,
  pcPaired: false,
  pcAccessGranted: false,
  connections: 0,
  paused: false,
  desktopFolder: null,
};

const Ctx = createContext<{
  demo: DemoState;
  set: (patch: Partial<DemoState>) => void;
  reset: () => void;
  loadFull: () => void;
}>({ demo: initial, set: () => {}, reset: () => {}, loadFull: () => {} });

const KEY = "kloda-demo";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState<DemoState>(initial);
  useEffect(() => {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) {
      try {
        setDemo({ ...initial, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      }
    }
  }, []);
  const persist = (next: DemoState) => {
    setDemo(next);
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  };
  return (
    <Ctx.Provider
      value={{
        demo,
        set: (patch) => persist({ ...demo, ...patch }),
        reset: () => persist(initial),
        loadFull: () =>
          persist({
            mobileSetupDone: true,
            photoPermission: "granted",
            sourcesSelected: true,
            pcPaired: true,
            pcAccessGranted: true,
            connections: 3,
            paused: false,
            desktopFolder: "/Users/ayhan/Kloda Yedekleri",
          }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useDemo = () => useContext(Ctx);
