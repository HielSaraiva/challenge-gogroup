"use client";
import { useEffect, useState } from "react";
type Files = { orders: string; customers: string; carriers: string };
type Preview = {
  orders: number;
  sourceRows: number;
  duplicates: number;
  conflicts: number;
  promiseMismatches: number;
};
type Status = {
  available: boolean;
  source: string;
  importedAt?: string;
  orders?: number;
  canImport: boolean;
};
const fields = [
  ["orders", "pedidos_excecao.csv"],
  ["customers", "clientes.csv"],
  ["carriers", "transportadoras.csv"],
] as const;
export type DataImportProps = {
  onImported: () => Promise<void>;
};
export function useDataImportViewModel({ onImported }: DataImportProps) {
  const [files, setFiles] = useState<Partial<Files>>({});
  const [status, setStatus] = useState<Status>();
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileErrors, setFileErrors] = useState<
    Partial<Record<keyof Files, string>>
  >({});
  const [refreshPending, setRefreshPending] = useState(false);
  async function loadImported() {
    setBusy(true);
    try {
      await onImported();
      setRefreshPending(false);
    } catch {
      setRefreshPending(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/data", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setStatus(b);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Não foi possível consultar a base. Recarregue a página.");
      });
    return () => controller.abort();
  }, []);
  async function select(key: keyof Files, file?: File) {
    setPreview(undefined);
    setError("");
    setFileErrors((previous) => ({ ...previous, [key]: undefined }));
    setFiles((previous) => ({ ...previous, [key]: undefined }));
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size > (key === "carriers" ? 100_000 : 1_500_000)
    ) {
      setFileErrors((previous) => ({
        ...previous,
        [key]: !file.name.toLowerCase().endsWith(".csv")
          ? "Selecione um arquivo no formato CSV (.csv)."
          : `O arquivo deve ter até ${key === "carriers" ? "100 KB" : "1,5 MB"}.`,
      }));
      return;
    }
    try {
      const text = await file.text();
      setFiles((previous) => ({ ...previous, [key]: text }));
    } catch {
      setFileErrors((previous) => ({
        ...previous,
        [key]: "Não foi possível ler este arquivo. Selecione-o novamente.",
      }));
    }
  }
  async function submit(mode: "preview" | "commit") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, files }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      if (mode === "preview") setPreview(b);
      else {
        setPreview(undefined);
        setStatus({
          available: true,
          source: "session",
          orders: b.orders,
          canImport: true,
          importedAt: new Date().toISOString(),
        });
        await loadImported();
      }
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      const field = fields.find(([, filename]) => message.startsWith(filename));
      if (field)
        setFileErrors((previous) => ({ ...previous, [field[0]]: message }));
    } finally {
      setBusy(false);
    }
  }

  return {
    files,
    status,
    preview,
    busy,
    error,
    fileErrors,
    refreshPending,
    loadImported,
    select,
    submit,
    fields,
  };
}
