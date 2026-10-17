"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { latestPatternTask } from "@/domain/pattern-lifecycle";
import {
  exceptionLabels,
  type Insight,
  type Task,
  type Investigation,
} from "@/domain/types";
import { insightGroupLabel, generatedTextLabel } from "@/lib/utils";
import { paginate } from "@/lib/pagination";
import { Button } from "./ui/button";
import { Expandable } from "./ui/expandable";
import { Pagination } from "./ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
function recurrenceQuestion(p: Insight) {
  if (p.dimension === "promise_rule")
    return "Por que a promessa difere do contrato?";
  const problem: Record<string, string> = {
    vazamento_produto: "há vazamentos",
    atraso_entrega: "há atrasos",
    item_faltante: "faltam itens",
    falha_personalizacao: "a personalização falha",
    avaria_transporte: "há avarias",
    extravio: "há extravios",
    rastreio_parado: "o rastreio fica parado",
    devolvido_transportadora: "há devoluções",
  };
  const group = p.group.replaceAll("|", " / ");
  const where =
    (
      {
        lot: `no lote ${group}`,
        machine: `na máquina ${group}`,
        carrier: `com a transportadora ${group}`,
        shift: `no turno ${group}`,
        dc: `no CD ${group}`,
        gift:
          p.group === "true"
            ? "nos pedidos com brinde"
            : "nos pedidos sem brinde",
      } as Record<string, string>
    )[p.dimension] || `no grupo ${group}`;
  return `Por que ${problem[p.exception] || "este problema se repete"} ${where}?`;
}

export function ImprovementsWorkspace({
  patterns,
  tasks,
  runs,
  busy,
  activePatternId,
  activity,
  onInvestigate,
  onProcess,
  onPending,
}: {
  patterns: Insight[];
  tasks: Task[];
  runs: Investigation[];
  busy: boolean;
  activePatternId?: string;
  activity: ReactNode;
  onInvestigate: (id: string, previousTaskId?: string) => Promise<void>;
  onProcess: (id: string) => void;
  onPending: () => void;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [confirm, setConfirm] = useState<Task>();
  const region = useRef<HTMLElement>(null);
  const analysis = useRef<HTMLDivElement>(null);
  const starting = useRef(false);
  const view = paginate(
    patterns.filter((pattern) => pattern.scope === "process"),
    page,
    size,
  );
  const changePage = (next: number) => {
    setPage(next);
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  useEffect(() => {
    if (!busy || !activePatternId) return;
    const frame = requestAnimationFrame(() => {
      starting.current = false;
      analysis.current?.focus({ preventScroll: true });
      analysis.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, activePatternId]);
  return (
    <section
      className="improvements-workspace paged-workspace"
      ref={region}
      tabIndex={-1}
      aria-label="Sinais de recorrência"
    >
      <div className="panel prose">
        <h2>Qual problema pode estar se repetindo?</h2>
        <p>
          Escolha um sinal para a IA consultar uma amostra e registrar uma
          investigação. Depois, a equipe confere as evidências e documenta a
          conclusão. Isso não resolve pedidos em lote nem implanta uma melhoria
          automaticamente.
        </p>
        <p>
          Os sinais usam a base de exceções e não indicam taxa de falha sobre
          todas as vendas. Ordem: relevância do sinal calculada a partir da
          concentração observada.
        </p>
        <Button variant="outline" onClick={onPending}>
          Acompanhar investigações abertas
        </Button>
      </div>
      {activity &&
        (busy ||
          view.items.some((pattern) => pattern.id === activePatternId)) && (
          <div
            className="pattern-analysis"
            ref={analysis}
            tabIndex={-1}
            aria-label="Análise da recorrência"
          >
            {busy ? (
              <>
                <p className="list-count">
                  Analisando:{" "}
                  {
                    patterns.find((pattern) => pattern.id === activePatternId)
                      ?.title
                  }
                </p>
                {activity}
              </>
            ) : (
              <Expandable className="panel prose">
                <summary>
                  Análise registrada:{" "}
                  {
                    patterns.find((pattern) => pattern.id === activePatternId)
                      ?.title
                  }
                </summary>
                {activity}
              </Expandable>
            )}
          </div>
        )}
      <p className="list-count">
        {view.total} sinais disponíveis · {view.start}–{view.end} nesta página
      </p>
      <div className="insight-grid">
        {view.items.map((pattern) => {
          const existing = latestPatternTask(tasks, pattern.id);
          const completed =
            existing?.status === "concluida" && Boolean(existing.conclusion);
          const lastRun = runs.find(
            (run) => run.type === "pattern" && run.target === pattern.id,
          );
          const working = busy && activePatternId === pattern.id;
          return (
            <article className="panel prose signal-card" key={pattern.id}>
              <div className="signal-badges">
                <span className="badge">
                  {exceptionLabels[pattern.exception] || "Prazo prometido"}
                </span>
                {existing && (
                  <span className="badge">
                    {completed
                      ? "Investigação concluída"
                      : "Investigação aberta"}
                  </span>
                )}
              </div>
              <h3>{recurrenceQuestion(pattern)}</h3>
              <p className="signal-group">
                <strong>Grupo:</strong> {insightGroupLabel(pattern.group)}
              </p>
              <p>
                <strong>{pattern.count}</strong> casos relacionados nesta
                análise.
              </p>
              <Expandable>
                <summary>O que conferir neste sinal?</summary>
                <p>{generatedTextLabel(pattern.investigationQuestion)}</p>
                <p>
                  {generatedTextLabel(pattern.title)}. A concentração é um ponto
                  de partida; valide os registros e as condições da operação
                  antes de concluir causa.
                </p>
                <p>Referências: {pattern.evidenceIds.slice(0, 3).join(", ")}</p>
              </Expandable>
              {lastRun?.status === "failed" && (
                <p className="signal-feedback">
                  {existing
                    ? completed
                      ? "A nova análise não foi concluída. A conclusão anterior foi preservada."
                      : "A execução foi interrompida, mas a investigação registrada está disponível para acompanhamento."
                    : "A tentativa anterior não concluiu uma investigação. Você pode tentar novamente; a nova chamada usa a cota da IA."}
                </p>
              )}
              <div className="signal-actions">
                <Button
                  disabled={busy}
                  onClick={() =>
                    existing
                      ? onProcess(existing.id)
                      : void onInvestigate(pattern.id)
                  }
                >
                  {existing
                    ? completed
                      ? "Ver conclusão da investigação"
                      : "Abrir investigação"
                    : working
                      ? "Investigando recorrência…"
                      : lastRun?.status === "failed"
                        ? "Tentar investigação novamente"
                        : "Investigar recorrência com IA"}
                </Button>
                {completed && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirm(existing)}
                  >
                    Iniciar nova análise com IA
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!view.total && (
        <div className="panel prose workspace-empty">
          <h3>Nenhum sinal suficiente nesta base</h3>
          <p>
            Continue pelas tratativas individuais. Novas evidências podem
            sustentar uma investigação de recorrência.
          </p>
        </div>
      )}
      <Pagination
        {...view}
        noun="sinais"
        pageSize={size}
        sizes={[6, 12, 24, 48, 96]}
        onPage={changePage}
        onPageSize={(next) => {
          setSize(next);
          changePage(1);
        }}
      />
      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(undefined);
        }}
      >
        <DialogContent
          className="new-plan-dialog"
          onCloseAutoFocus={(event) => {
            if (starting.current || busy) event.preventDefault();
          }}
        >
          <DialogTitle>Iniciar outra investigação deste sinal?</DialogTitle>
          <DialogDescription>
            A investigação anterior já foi concluída. A nova chamada à IA usa a
            cota disponível e cria outro registro para a equipe verificar. A
            conclusão anterior será preservada.
          </DialogDescription>
          <p>
            {confirm?.conclusion?.outcome === "inconclusiva"
              ? "A conclusão anterior foi inconclusiva. A nova investigação deve apoiar a continuidade da verificação."
              : "Repita a investigação quando houver motivo ou novas verificações a realizar. A análise usa os dados disponíveis nesta sessão."}
          </p>
          <div className="new-plan-footer">
            <Button variant="outline" onClick={() => setConfirm(undefined)}>
              Cancelar
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const previous = confirm;
                starting.current = true;
                setConfirm(undefined);
                if (previous?.insightId)
                  void onInvestigate(previous.insightId, previous.id);
              }}
            >
              Confirmar nova análise
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
