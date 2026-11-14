import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

const field =
  "h-9 w-full rounded-md border border-primary bg-card px-3 text-sm focus-visible:outline-2 aria-[invalid=true]:border-destructive";

/** Input fields use the workbook "state.input" token: white + brand border. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(field, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-secondary-foreground", className)} {...props} />;
}
