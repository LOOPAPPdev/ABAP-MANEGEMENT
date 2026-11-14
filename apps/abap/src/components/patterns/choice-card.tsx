import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface GroupProps {
  legend: string;
  name: string;
  options: ChoiceOption[];
  multiple?: boolean;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

/**
 * CardSelectionGroup + ChoiceCard (Adaptive Card-Based Questionnaire).
 * Native radio/checkbox inputs keep keyboard behaviour and semantics; the card is the label.
 * Selection is shown by a check mark and a thicker border, not by colour alone.
 */
export function CardSelectionGroup({ legend, name, options, multiple = false, value, onChange, error }: GroupProps) {
  const errorId = error ? `${name}-error` : undefined;
  return (
    <fieldset aria-describedby={errorId} data-component-id="card-selection-group">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label
              key={o.value}
              data-component-id="choice-card"
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-md border bg-card p-3 text-sm transition-colors hover:border-primary",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                checked ? "border-2 border-input bg-sel" : "border-border",
                o.disabled && "cursor-not-allowed opacity-50",
                error && !checked && "border-destructive",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                className="sr-only"
                onChange={(e) =>
                  onChange(multiple ? (e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value)) : [o.value])
                }
              />
              <span className="flex items-center justify-between font-semibold">
                {o.label}
                <span
                  aria-hidden="true"
                  className={cn("inline-flex h-5 w-5 items-center justify-center rounded-[4px] border", checked ? "border-input bg-primary text-primary-foreground" : "border-border")}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
              </span>
              {o.description && <span className="text-muted-foreground">{o.description}</span>}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-destructive-strong">
          {error}
        </p>
      )}
    </fieldset>
  );
}
