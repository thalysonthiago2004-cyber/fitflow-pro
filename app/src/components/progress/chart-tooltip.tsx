// Tooltip body shared by progress charts: value first (strong), label second.
export function ChartTooltip({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <strong className="text-sm tabular-nums">{value}</strong>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export function ChartTable({ caption, headers, rows }: { caption: string; headers: [string, string]; rows: [string, string][] }) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Ver em tabela
      </summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-muted-foreground">
            <th scope="col" className="py-1.5 font-medium">{headers[0]}</th>
            <th scope="col" className="py-1.5 text-right font-medium">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-b last:border-0">
              <td className="py-1.5">{a}</td>
              <td className="py-1.5 text-right tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
