import { WEEKDAYS } from "@/lib/workouts/labels";

// Native checkboxes styled as chips: keyboard and screen-reader friendly, and
// submitted as repeated `weekdays` form values.
export function WeekdayPicker({ defaultValue = [], idPrefix }: { defaultValue?: number[]; idPrefix: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Dias da semana</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day, index) => (
          <label key={day.short} htmlFor={`${idPrefix}-day-${index}`} className="cursor-pointer">
            <input
              id={`${idPrefix}-day-${index}`}
              type="checkbox"
              name="weekdays"
              value={index}
              defaultChecked={defaultValue.includes(index)}
              className="peer sr-only"
            />
            <span className="flex h-11 min-w-12 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-muted peer-checked:hover:bg-primary/90">
              <span aria-hidden>{day.short}</span>
              <span className="sr-only">{day.long}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
