"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { latestPatternTask } from "@/domain/pattern-lifecycle";
import {
  exceptionLabels,
  type Insight,
  type Task,
  type Investigation,
} from "@/domain/types";
import { generatedTextLabel, insightGroupLabel } from "@/lib/utils";
import { paginate } from "@/lib/pagination";
import { Button } from "./ui/button";
import { Pagination } from "./ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

export function ImprovementsWorkspace({
  patterns,
  tasks,
  runs,
  busy,
  analyzing,
  activity,
  onAnalyze,
  onInvestigate,
  onProcess,
  onPending,
}: {
  patterns: Insight[];
  tasks: Task[];
  runs: Investigation[];
  busy: boolean;
  analyzing: boolean;
  activity: ReactNode;
  onAnalyze: () => Promise<void>;
  onInvestigate: (id: string, previousTaskId?: string) => Promise<void>;
  onProcess: (id: string) => void;
  onPending: () => void;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(6);
  const [confirmAnalysis, setConfirmAnalysis] = useState(false);
  const [confirmTask, setConfirmTask] = useState<Task>();
  const region = useRef<HTMLElement>(null);
  const analysis = useRef<HTMLDivElement>(null);
  const starting = useRef(false);
  const locked =
    busy ||
    runs.some(
      (run) =>
        run.status === "running" &&
        Date.now() - Date.parse(run.updatedAt) < 70000,
    );
  const reviewed = runs.find(
    (run) =>
      run.type === "recurrences" &&
      run.status === "completed" &&
      run.recurrenceReview,
  );
  const investigations = tasks
    .filter(
      (task) =>
        task.scope === "process" &&
        (!task.insightId ||
          latestPatternTask(tasks, task.insightId)?.id === task.id),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  const view = paginate(investigations, page, size);
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
    if (!analyzing) return;
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
  }, [analyzing]);
  const startAnalysis = () => {
    setPage(1);
    starting.current = true;
    setConfirmAnalysis(false);
    void onAnalyze();
  };
  return (
    <section
      className="improvements-workspace paged-workspace"
      ref={region}
      tabIndex={-1}
      aria-label="Investigações de recorrência"
    >
      <div className="panel prose">
        <h2>Quais problemas merecem uma investigação?</h2>
        <p>
          O agente compara os agrupamentos de maior relevância na base e propõe
          até três investigações por análise, com evidências, hipótese e próximo
          passo. A equipe verifica e registra a conclusão.
        </p>
        <div className="task-actions">
          <Button
            disabled={locked}
            onClick={() => {
              if (reviewed || investigations.length) setConfirmAnalysis(true);
              else startAnalysis();
            }}
          >
            {analyzing
              ? "Analisando recorrências…"
              : reviewed
                ? "Analisar a base novamente com IA"
                : "Analisar recorrências com IA"}
          </Button>
          <Button variant="outline" onClick={onPending}>
            Acompanhar investigações abertas
          </Button>
        </div>
        <p className="muted">
          A análise usa a cota da IA. A base contém pedidos com problemas;
          concentrações não comprovam causas nem taxas de falha de todas as
          vendas.
        </p>
      </div>
      {activity && (
        <div
          className="pattern-analysis"
          ref={analysis}
          tabIndex={-1}
          aria-label="Atividade da análise de recorrências"
        >
          {activity}
        </div>
      )}
      {reviewed?.recurrenceReview && (
        <section className="panel prose">
          <h3>
            {reviewed.taskIds.length
              ? reviewed.taskIds.length ===
                reviewed.recurrenceReview.reusedTaskIds.length
                ? "Investigações existentes mantidas"
                : "Seleção do agente"
              : "Nenhuma nova investigação proposta"}
          </h3>
          <p>{generatedTextLabel(reviewed.recurrenceReview.reason)}</p>
          <p>
            {reviewed.taskIds.length -
              reviewed.recurrenceReview.reusedTaskIds.length}{" "}
            novas · {reviewed.recurrenceReview.reusedTaskIds.length} mantidas
            {reviewed.consultedInsightIds
              ? ` · ${reviewed.consultedInsightIds.length} agrupamentos examinados nesta análise`
              : ""}
            .
          </p>
          <p className="list-count">
            Análise de {new Date(reviewed.createdAt).toLocaleString("pt-BR")} ·
            Os registros anteriores foram preservados.
          </p>
        </section>
      )}
      {!view.total && !analyzing && (
        <div className="panel prose workspace-empty">
          <h3>
            {reviewed
              ? "Nenhuma investigação registrada"
              : "Comece pela análise da base"}
          </h3>
          <p>
            {reviewed
              ? "Neste recorte, a análise não propôs novas investigações. Você pode continuar pelas tratativas individuais em Pedidos."
              : "Clique em “Analisar recorrências com IA”. Os cards aparecerão quando o agente registrar suas propostas."}
          </p>
        </div>
      )}
      {view.total > 0 && (
        <p className="list-count">
          {view.total} {view.total === 1 ? "investigação" : "investigações"} ·{" "}
          {view.start}–{view.end} nesta página
        </p>
      )}
      <div className="insight-grid">
        {view.items.map((task) => {
          const pattern = patterns.find((item) => item.id === task.insightId);
          const completed =
            task.status === "concluida" && Boolean(task.conclusion);
          return (
            <article className="panel prose signal-card" key={task.id}>
              <div className="signal-badges">
                <span className="badge">
                  {pattern
                    ? exceptionLabels[pattern.exception] || "Prazo prometido"
                    : "Recorrência"}
                </span>
                <span className="badge">
                  {completed
                    ? "Conclusão registrada"
                    : task.processProgress
                      ? "Em verificação"
                      : "Investigação aberta"}
                </span>
              </div>
              <h3>{generatedTextLabel(task.title)}</h3>
              <p className="signal-group">
                <strong>Grupo:</strong>{" "}
                {pattern
                  ? insightGroupLabel(pattern.group)
                  : "Consulte as evidências"}
              </p>
              <p>
                <strong>
                  {pattern?.count ??
                    task.affectedOrderIds?.length ??
                    task.evidenceIds.length}
                </strong>{" "}
                casos relacionados na base.
              </p>
              <p className="list-count">Proposta pelo agente · {task.area}</p>
              {task.processProgress?.nextStep && !completed && (
                <p className="signal-followup">
                  <strong>Próxima ação registrada:</strong>{" "}
                  {task.processProgress.nextStep}
                </p>
              )}
              <div className="signal-actions">
                <Button disabled={locked} onClick={() => onProcess(task.id)}>
                  {completed
                    ? "Ver conclusão da investigação"
                    : "Abrir investigação"}
                </Button>
                {completed && task.insightId && (
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() => setConfirmTask(task)}
                  >
                    Investigar este grupo novamente
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Pagination
        {...view}
        noun={view.total === 1 ? "investigação" : "investigações"}
        pageSize={size}
        sizes={[6, 12, 24, 48, 96]}
        onPage={changePage}
        onPageSize={(next) => {
          setSize(next);
          changePage(1);
        }}
      />
      <Dialog open={confirmAnalysis} onOpenChange={setConfirmAnalysis}>
        <DialogContent
          className="new-plan-dialog"
          onCloseAutoFocus={(event) => {
            if (starting.current) event.preventDefault();
          }}
        >
          <DialogTitle>Analisar a base novamente?</DialogTitle>
          <DialogDescription>
            O agente compara os agrupamentos e considera as investigações e
            conclusões existentes. A análise usa a cota da IA e pode não
            encontrar novos achados.
          </DialogDescription>
          <p>
            As investigações anteriores serão preservadas. Grupos já registrados
            não serão recriados automaticamente.
          </p>
          <div className="new-plan-footer">
            <Button variant="outline" onClick={() => setConfirmAnalysis(false)}>
              Cancelar
            </Button>
            <Button disabled={locked} onClick={startAnalysis}>
              Confirmar nova análise
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(confirmTask)}
        onOpenChange={(open) => {
          if (!open) setConfirmTask(undefined);
        }}
      >
        <DialogContent
          className="new-plan-dialog"
          onCloseAutoFocus={(event) => {
            if (starting.current) event.preventDefault();
          }}
        >
          <DialogTitle>Investigar este grupo novamente?</DialogTitle>
          <DialogDescription>
            A conclusão anterior será preservada. A nova análise consulta o
            mesmo grupo, considera a conclusão e cria outra etapa para
            verificação. Essa chamada usa a cota da IA.
          </DialogDescription>
          <div className="new-plan-footer">
            <Button variant="outline" onClick={() => setConfirmTask(undefined)}>
              Cancelar
            </Button>
            <Button
              disabled={locked}
              onClick={() => {
                const task = confirmTask;
                setConfirmTask(undefined);
                starting.current = true;
                if (task?.insightId)
                  void onInvestigate(task.insightId, task.id);
              }}
            >
              Confirmar nova investigação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
