"use client";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import {
  fieldValidationMessage,
  type FormControl,
} from "@/presentation/shared/validation/field-validation";

type FieldIssue = {
  id: string;
  label: string;
  message: string;
  element: FormControl;
};
type CheckField = () => FieldIssue | undefined;
const Validation = createContext<
  ((id: string, check?: CheckField) => void) | null
>(null);

/** One validation path for keyboard and pointer submission, without browser-only tooltips. */
export function ValidatedForm({
  children,
  onSubmit,
  onChangeCapture,
  ...props
}: ComponentProps<"form">) {
  const fields = useRef(new Map<string, CheckField>());
  const summary = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const register = useCallback((id: string, check?: CheckField) => {
    if (check) fields.current.set(id, check);
    else fields.current.delete(id);
  }, []);
  return (
    <Validation.Provider value={register}>
      <form
        {...props}
        noValidate
        onChangeCapture={(event) => {
          setIssues([]);
          onChangeCapture?.(event);
        }}
        onSubmit={(event) => {
          const errors = [...fields.current.values()].flatMap((check) => {
            const issue = check();
            return issue ? [issue] : [];
          });
          errors.sort((a, b) =>
            a.element.compareDocumentPosition(b.element) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          );
          setIssues(errors);
          if (errors.length) {
            event.preventDefault();
            requestAnimationFrame(() => summary.current?.focus());
            return;
          }
          onSubmit?.(event);
        }}
      >
        {issues.length > 0 && (
          <div
            className="form-error-summary"
            role="alert"
            tabIndex={-1}
            ref={summary}
            aria-label="Campos para corrigir"
          >
            <strong>
              Confira{" "}
              {issues.length === 1
                ? "o campo destacado"
                : "os campos destacados"}{" "}
              antes de continuar.
            </strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue.id}>
                  <a
                    href={`#${issue.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      issue.element.focus();
                    }}
                  >
                    {issue.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {children}
      </form>
    </Validation.Provider>
  );
}

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};
type FieldProps = ComponentProps<"label"> & {
  validate?: (value: string) => string | undefined;
  error?: string;
};

/** Keep the error attached to its control and recheck it while the user corrects it. */
export function FormField({
  children,
  validate,
  error: externalError,
  onBlurCapture,
  onChangeCapture,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const label = useRef<HTMLLabelElement>(null);
  const [error, setError] = useState("");
  const register = useContext(Validation);
  const message = externalError || error;
  const errorId = `${generatedId}-error`;
  const caption = Children.toArray(children)
    .filter((child) => typeof child === "string" || typeof child === "number")
    .map((child) => String(child).trim())
    .filter(Boolean)
    .join(" ");
  const check = useCallback(
    (show = true) => {
      const element = label.current?.querySelector<FormControl>(
        "input,select,textarea",
      );
      if (!element) return;
      const message =
        fieldValidationMessage(element) ||
        (!element.matches(":disabled") ? validate?.(element.value) : "") ||
        "";
      if (show) setError(message);
      if (!message) return;
      const text = Array.from(label.current!.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .join(" ");
      return {
        id: element.id,
        label: text || "Conferir campo",
        element,
        message,
      };
    },
    [validate],
  );
  useEffect(() => {
    if (error) check();
  }, [children, error, check]);
  useEffect(() => {
    register?.(generatedId, check);
    return () => register?.(generatedId);
  }, [register, generatedId, check]);
  return (
    <label
      {...props}
      ref={label}
      onBlurCapture={(event) => {
        // Inserting an error during pointer-down can move the button before click.
        // Submission validates all fields; partial-save buttons keep their own rules.
        const target = event.relatedTarget;
        if (!(
          target instanceof HTMLElement &&
          target.closest("button,input[type=submit]")
        ))
          check();
        onBlurCapture?.(event);
      }}
      onChangeCapture={(event) => {
        if (error) check();
        onChangeCapture?.(event);
      }}
    >
      {Children.map(children, (child) => {
        if (
          !isValidElement(child) ||
          !["input", "select", "textarea"].includes(String(child.type))
        )
          return child;
        const control = child as ReactElement<ControlProps>;
        return cloneElement(control, {
          id: control.props.id || generatedId,
          "aria-label": control.props["aria-label"] || caption || undefined,
          "aria-invalid": message ? true : undefined,
          "aria-describedby":
            [control.props["aria-describedby"], message ? errorId : ""]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      })}
      {message && (
        <span id={errorId} className="field-error">
          {message}
        </span>
      )}
    </label>
  );
}
