"use client";
import { Button } from "@/presentation/shared/ui/button";
import { FormField } from "@/presentation/shared/ui/form";
import { Database, Loader2 } from "lucide-react";
import {
  useDataImportViewModel,
  type DataImportProps,
} from "./use-data-import-view-model";

export function DataImport({ onImported }: DataImportProps) {
  const {
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
  } = useDataImportViewModel({
    onImported,
  });
  return (
    <div className="data-workspace">
      <section className="panel prose">
        <h2>
          <Database size={21} aria-hidden="true" /> Base de operações
        </h2>
        <p>
          A importação é opcional quando a base padrão estiver disponível. A
          referência dos cálculos é<strong> 30/09/2026</strong>.
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
          enviados são processados no servidor e ficam vinculados à sua sessão.
          O acesso à sessão expira em sete dias. Investigar com IA envia
          evidências selecionadas ao Groq.
        </p>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        {refreshPending && (
          <div className="alert alert-info" role="status">
            Base importada. Não foi possível carregar os novos dados.{" "}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void loadImported()}
            >
              {busy ? "Carregando…" : "Tentar carregar novamente"}
            </Button>
          </div>
        )}
        {refreshPending ? null : !status ? (
          !error && (
            <p className="alert alert-info" role="status" aria-live="polite">
              Conferindo a base e a disponibilidade de importação…
            </p>
          )
        ) : !status.canImport ? (
          <p className="alert alert-info">
            Há tratativas nesta demonstração. Para trocar a base sem misturar
            históricos, reinicie a demonstração nesta área Dados e volte aqui.
          </p>
        ) : (
          <>
            <fieldset disabled={busy || !status} className="import-fields">
              <legend>1. Selecione os arquivos CSV em UTF-8</legend>
              {fields.map(([key, label]) => (
                <FormField key={key} error={fileErrors[key]}>
                  {label}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void select(key, e.target.files?.[0])}
                  />
                </FormField>
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
          automática com os sistemas da Gocase e da GoBeauté está explicado em
          Metodologia.
        </p>
      </section>
    </div>
  );
}
