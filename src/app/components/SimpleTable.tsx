type Row = Record<string, unknown>;

export default function SimpleTable({ data }: { data: Row[] }) {
  const columns = Array.from(
    data.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  if (data.length === 0) {
    return <p className="opacity-70">データがありません。</p>;
  }

  return (
    <div className="overflow-auto rounded-xl border border-black/10 dark:border-white/20">
      <table className="min-w-[320px] text-sm">
        <thead className="bg-black/5 dark:bg-white/5">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold">
                {col}
              </th>
            ))}
            <th className="px-3 py-2 text-left font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="even:bg-black/5/50 dark:even:bg-white/5/50">
              {columns.map((col) => (
                <td key={col} className="whitespace-pre-wrap px-3 py-2 align-top">
                  {formatCell(row[col])}
                </td>
              ))}
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:opacity-90">部品詳細</button>
                  <button className="rounded-md bg-sky-600 px-3 py-1 text-white hover:opacity-90">編集</button>
                  <button className="rounded-md bg-rose-600 px-3 py-1 text-white hover:opacity-90">削除</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}


