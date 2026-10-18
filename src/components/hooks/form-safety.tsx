"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

type State = { dirty: boolean; busy: boolean };
const Safety = createContext<((id: string, state?: State) => void) | null>(
  null,
);
export function FormSafetyBoundary({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange: (state: State) => void;
}) {
  const entries = useRef(new Map<string, State>());
  const report = useCallback(
    (id: string, state?: State) => {
      if (state) entries.current.set(id, state);
      else entries.current.delete(id);
      onChange({
        dirty: [...entries.current.values()].some((s) => s.dirty),
        busy: [...entries.current.values()].some((s) => s.busy),
      });
    },
    [onChange],
  );
  return <Safety.Provider value={report}>{children}</Safety.Provider>;
}
export function useDraftGuard(draft: unknown, busy: boolean, version: string) {
  const id = useId();
  const report = useContext(Safety);
  const serialized = JSON.stringify(draft);
  const [baseline, setBaseline] = useState(serialized);
  const [savedVersion, setSavedVersion] = useState<string>();
  const committed = savedVersion === version;
  const dirty = !committed && serialized !== baseline;
  useEffect(() => {
    report?.(id, { dirty, busy });
  }, [report, id, dirty, busy]);
  useEffect(() => () => report?.(id), [report, id]);
  return {
    committed,
    markSaved: () => {
      setBaseline(serialized);
      setSavedVersion(version);
    },
  };
}
