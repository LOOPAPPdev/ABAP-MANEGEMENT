import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

const field =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 aria-[invalid=true]:border-destructive";

/** Input fields in the ABAP design system (bundle): card background, light input border, focus ring. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(field, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-secondary-foreground", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "h-auto min-h-24 py-2 leading-relaxed", className)} {...props} />;
}
