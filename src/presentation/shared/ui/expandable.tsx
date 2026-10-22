import { Children, type ComponentPropsWithoutRef } from "react";

/** Keep the native summary control separate from the consistently inset body. */
export function Expandable({
  children,
  ...props
}: ComponentPropsWithoutRef<"details">) {
  const [summary, ...content] = Children.toArray(children);
  return (
    <details {...props}>
      {summary}
      <div className="expandable-content">{content}</div>
    </details>
  );
}
