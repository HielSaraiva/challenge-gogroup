import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      outline: "button-outline",
      ghost: "button-ghost",
    },
    size: { default: "", sm: "button-small" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variants>) {
  return (
    <button className={cn(variants({ variant, size }), className)} {...props} />
  );
}
