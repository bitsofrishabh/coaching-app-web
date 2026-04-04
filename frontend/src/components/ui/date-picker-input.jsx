import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const parseDateValue = (value) => {
  if (!value) return undefined;
  try {
    const parsed = parseISO(String(value));
    return isValid(parsed) ? parsed : undefined;
  } catch (_error) {
    return undefined;
  }
};

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Select date",
  variant = "field",
  className,
  buttonClassName,
  contentClassName,
  clearable = true,
  disabled = false,
  align = "start",
  displayFormat = "MMMM d, yyyy",
  title,
  id,
  "data-testid": dataTestId,
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const isInlineVariant = variant === "inline";

  const setDateValue = (nextDate) => {
    if (!nextDate) {
      onChange?.("");
      return;
    }
    onChange?.(format(nextDate, "yyyy-MM-dd"));
  };

  const formattedValue = selectedDate ? format(selectedDate, displayFormat) : placeholder;

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={id}
            title={title}
            disabled={disabled}
            data-testid={dataTestId}
            className={cn(
              isInlineVariant
                ? "h-9 w-full justify-start rounded-none border-0 bg-transparent px-0 text-left text-[15px] font-medium shadow-none hover:bg-transparent hover:opacity-80"
                : "h-11 w-full justify-between rounded-xl border-border/60 bg-background px-3 text-left font-normal shadow-none hover:bg-muted/30",
              !selectedDate && "text-muted-foreground",
              buttonClassName
            )}
          >
            <span className="flex min-w-0 items-center gap-2 overflow-hidden">
              {!isInlineVariant ? <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
              <span className="truncate">{formattedValue}</span>
            </span>
            {!isInlineVariant ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} className={cn("w-[320px] rounded-2xl border border-border/70 p-0 shadow-[0_18px_48px_rgba(15,23,42,0.16)]", contentClassName)}>
          <div className="border-b border-border/60 px-3 py-3">
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-[15px] font-medium text-foreground">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder}
            </div>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(nextDate) => {
              setDateValue(nextDate);
              if (nextDate) setOpen(false);
            }}
            defaultMonth={selectedDate || new Date()}
            initialFocus
            className="rounded-xl"
          />
          <div className="border-t border-border/60 px-3 py-2">
            {clearable ? (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-[15px] font-medium text-foreground transition-colors hover:bg-muted/40"
                onClick={() => {
                  setDateValue(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
