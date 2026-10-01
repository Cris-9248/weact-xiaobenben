"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { zhCN } from "date-fns/locale";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** `datetime-local` wire format: `YYYY-MM-DDTHH:mm` (local time, no zone). */
export const DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

/** All fields come from FORMAT, so the reference date can never affect the
 *  result. It is a module constant rather than `new Date()` because parsing runs
 *  during render, and the `react-hooks/purity` rule rejects reading the clock
 *  mid-render. */
const PARSE_REFERENCE = new Date(0);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0")
);

/** Bounds for the year/month dropdowns. Module constants for the same
 *  render-purity reason as above. */
const FIRST_MONTH = new Date(2000, 0, 1);
const LAST_MONTH = new Date(2100, 11, 31);

function parseValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, DATE_TIME_FORMAT, PARSE_REFERENCE);
  return isValid(parsed) ? parsed : undefined;
}

function splitTime(value: string | undefined): { hour: string; minute: string } {
  const match = /T(\d{2}):(\d{2})/.exec(value ?? "");
  return { hour: match?.[1] ?? "18", minute: match?.[2] ?? "00" };
}

/**
 * Themed replacement for `<input type="datetime-local">`.
 *
 * The native control draws its own calendar popup with OS chrome — it ignores
 * `--radius`, `--popover` and the rest of the theme, which is exactly the
 * mismatch this component exists to remove.
 *
 * Emits the same `datetime-local` string the native input produced, so callers
 * (and eventually the Server Action payload) are unaffected by the swap.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "选择日期与时间",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const { hour, minute } = splitTime(value);

  /**
   * Keeps the existing time when only the day changes. `null` means a Base UI
   * select was cleared — fall back rather than coercing it to `0` via Number().
   */
  function commit(day: Date, nextHour?: string | null, nextMinute?: string | null) {
    const withTime = new Date(day);
    withTime.setHours(
      Number(nextHour ?? hour),
      Number(nextMinute ?? minute),
      0,
      0
    );
    onChange(format(withTime, DATE_TIME_FORMAT));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            data-empty={!selected}
            className={cn(
              // Mirrors `Input`'s box so the two line up in the same form row.
              "h-11 w-full justify-start gap-2 px-2.5 text-left font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">
          {selected
            ? format(selected, "yyyy年M月d日 EEE HH:mm", { locale: zhCN })
            : placeholder}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-1rem)] gap-0 p-0"
      >
        <Calendar
          mode="single"
          locale={zhCN}
          captionLayout="dropdown"
          startMonth={FIRST_MONTH}
          endMonth={LAST_MONTH}
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => {
            if (day) commit(day);
          }}
          // The generated wrapper hardcodes `w-fit` on the root, which leaves the
          // calendar narrower than the popover and stranded against the left
          // edge. `classNames` is spread last in calendar.tsx, so this replaces
          // that entry outright — no specificity fight over two width utilities.
          // `rdp-root` is react-day-picker's own base class (verified against
          // getDefaultClassNames() on 10.0.1) and has to be repeated here.
          classNames={{ root: "rdp-root w-full" }}
          autoFocus
        />

        <div className="flex items-center gap-2 border-t p-2.5">
          <span className="text-xs text-muted-foreground">时间</span>
          <Select
            value={hour}
            onValueChange={(next) => {
              // Without a day there is nothing to attach a time to; picking the
              // day is what creates the value.
              if (selected) commit(selected, next, minute);
            }}
            disabled={!selected}
          >
            <SelectTrigger size="sm" aria-label="小时" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select
            value={minute}
            onValueChange={(next) => {
              if (selected) commit(selected, hour, next);
            }}
            disabled={!selected}
          >
            <SelectTrigger size="sm" aria-label="分钟" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={!value}
            onClick={() => onChange("")}
          >
            清除
          </Button>
        </div>

        <div className="border-t p-2.5">
          {/* The value is committed on each pick, so this only dismisses —
              closing by clicking away keeps whatever was chosen, and the button
              just makes "I'm done" explicit. */}
          <Button
            type="button"
            className="w-full"
            disabled={!selected}
            onClick={() => setOpen(false)}
          >
            确认
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
