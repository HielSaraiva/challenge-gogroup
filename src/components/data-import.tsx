"use client";
import { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
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
export function DataImport({
  onImported,
}: {
  onImported: () => Promise<void>;
}) {
  const [files, setFiles] = useState<Partial<Files>>({});
  const [status, setStatus] = useState<Status>();
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    setNotice("");
    setFiles((previous) => ({ ...previous, [key]: undefined }));
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size > (key === "carriers" ? 100_000 : 1_500_000)
    ) {
      setError("Selecione um CSV de até 1,5 MB (transportadoras: até 100 KB).");
      return;
    }
    try {
      const text = await file.text();
      setFiles((previous) => ({ ...previous, [key]: text }));
    } catch {
      setError("Não foi possível ler o arquivo. Selecione-o novamente.");
    }
  }
  async function submit(mode: "preview" | "commit") {
    setBusy(true);
    setError("");
    setNotice("");
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
        setNotice("Base importada. Abra Hoje para iniciar o trabalho.");
        setStatus({
          available: true,
          source: "session",
          orders: b.orders,
          canImport: true,
          importedAt: new Date().toISOString(),
        });
        await onImported();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="data-workspace">
      <section className="panel prose">
        <h2>
          <Database size={21} aria-hidden="true" /> Base de operações
        </h2>
        <p>
          A importação é opcional. Se você não adicionar uma base própria, a
          demonstração usará a base padrão, com data de referência em
          <strong> 30/09/2026</strong>.
        </p>
        <p>
          Para usar outra base, importe os três CSVs da mesma extração. Primeiro
          você confere a qualidade; a base só muda depois da confirmação.
        </p>
        {status?.available && (
          <div className="data-status">
            <b>
              {status.orders?.toLocaleString("pt-BR")} pedidos na base atual
            </b>
            <p>
              {status.source === "session"
                ? "Base exclusiva desta demonstração"
                : "Base preparada pelo administrador"}{" "}
              · importada em{" "}
              {status.importedAt
                ? new Date(status.importedAt).toLocaleString("pt-BR")
                : "—"}
              .
            </p>
          </div>
        )}
        <p>
          Use apenas dados sintéticos nesta demonstração pública. Arquivos
          enviados são processados no servidor e ficam vinculados à sua sessão
          por até sete dias. Investigar com IA envia evidências selecionadas ao
          Groq.
        </p>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="alert alert-info" role="status">
            {notice}
          </p>
        )}
        {status && !status.canImport ? (
          <p className="alert alert-info">
            Há tratativas nesta demonstração. Para trocar a base sem misturar
            históricos, reinicie a demonstração nesta área Dados e volte aqui.
          </p>
        ) : (
          <>
            <fieldset disabled={busy || !status} className="import-fields">
              <legend>1. Selecione os arquivos CSV em UTF-8</legend>
              {fields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void select(key, e.target.files?.[0])}
                  />
                </label>
              ))}
            </fieldset>
            <p className="muted">
              Até 2 MB no total · 10 mil pedidos · data de referência do piloto:
              30/09/2026. Outros períodos exigem revisão dos parâmetros.
            </p>
            <Button
              disabled={busy || !status || fields.some(([key]) => !files[key])}
              onClick={() => void submit("preview")}
            >
              {busy && <Loader2 className="spin" size={16} />} Validar arquivos
            </Button>
            {preview && (
              <div className="import-preview" aria-live="polite">
                <h3>2. Confira antes de importar</h3>
                <dl className="detail-grid">
                  <div>
                    <dt>Registros recebidos</dt>
                    <dd>{preview.sourceRows}</dd>
                  </div>
                  <div>
                    <dt>Pedidos únicos</dt>
                    <dd>{preview.orders}</dd>
                  </div>
                  <div>
                    <dt>Linhas consolidadas</dt>
                    <dd>{preview.duplicates}</dd>
                  </div>
                  <div>
                    <dt>Conflitos de status</dt>
                    <dd>{preview.conflicts}</dd>
                  </div>
                  <div>
                    <dt>Promessas divergentes do contrato</dt>
                    <dd>{preview.promiseMismatches}</dd>
                  </div>
                </dl>
                <p>
                  Conflitos serão sinalizados para revisão humana. As datas
                  prometidas são preservadas. A importação substitui apenas a
                  base desta sessão, sem alterar a de outros visitantes.
                </p>
                <Button disabled={busy} onClick={() => void submit("commit")}>
                  Confirmar importação de {preview.orders} pedidos
                </Button>
              </div>
            )}
          </>
        )}
      </section>
      <section className="panel prose">
        <h2>Antes de importar</h2>
        <p>
          Use arquivos da mesma extração e mantenha os nomes das colunas
          originais. Se recebeu um ZIP, descompacte-o e selecione apenas os três
          CSVs.
        </p>
        <p>
          Este piloto representa a operação em 30/09/2026. Pedidos ou eventos
          posteriores a essa data são bloqueados para evitar cálculos
          incorretos.
        </p>
        <p>
          A atualização é manual neste piloto. O caminho para integração
          automática com os sistemas da Gogroup está explicado em Metodologia.
        </p>
      </section>
    </div>
  );
}
