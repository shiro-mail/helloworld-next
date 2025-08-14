"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

type SaveRecord = {
  id: number;
  createdAt: string;
  raw: unknown;
  rows: unknown[];
};

type Row = Record<string, unknown>;

export default function SavesPage() {
  const [records, setRecords] = useState<SaveRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/saves", { cache: "no-store" });
        if (!res.ok) throw new Error("読み込みに失敗しました");
        const data = (await res.json()) as SaveRecord[];
        setRecords(Array.isArray(data) ? data : []);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void fetchData();
    const interval = window.setInterval(fetchData, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const toggleOpen = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const headers = useMemo(() => ["ID", "作成日時", "行数", "操作"], []);

  const toPreviewRows = (rows: unknown[], limit = 5): Row[] => {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, limit).filter((r) => typeof r === "object" && r !== null) as Row[];
  };

  const getColumns = (rows: Row[]): string[] => {
    const preferred = [
      "ページ",
      "出荷日",
      "受注番号",
      "納入先番号",
      "担当者",
      "運賃",
      "部品合計",
      "税抜合計",
    ];
    const set = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    const found = Array.from(set);
    const ordered = preferred.filter((k) => found.includes(k));
    const rest = found.filter((k) => !ordered.includes(k)).sort();
    return [...ordered, ...rest];
  };

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">保存データ一覧</h1>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
          ← 戻る
        </Link>
      </div>

      {error && <p className="mb-4 text-rose-600">{error}</p>}

      {records.length === 0 ? (
        <p className="opacity-70">保存データはまだありません。</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-black/10 dark:border-white/20">
          <table className="min-w-[640px] text-sm">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <Fragment key={r.id}>
                  <tr className="even:bg-black/5/50 dark:even:bg-white/5/50">
                    <td className="px-3 py-2">{r.id}</td>
                    <td className="px-3 py-2">{r.createdAt}</td>
                    <td className="px-3 py-2">{Array.isArray(r.rows) ? r.rows.length : 0}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleOpen(r.id)}
                        className="rounded-md border px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {openIds.has(r.id) ? "詳細(閉じる)" : "詳細"}
                      </button>
                    </td>
                  </tr>
                  {openIds.has(r.id) && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={headers.length} className="px-3 pb-4">
                        <div className="mt-2 rounded-lg border border-black/10 p-3 dark:border-white/20">
                          <div className="mb-2 text-xs opacity-70">プレビュー（先頭5件）</div>
                          {(() => {
                            const preview = toPreviewRows(r.rows);
                            if (preview.length === 0) {
                              return <p className="text-xs opacity-70">表示できる行がありません。</p>;
                            }
                            const cols = getColumns(preview);
                            return (
                              <div className="overflow-auto">
                                <table className="min-w-[640px] text-xs">
                                  <thead className="bg-black/5 dark:bg-white/5">
                                    <tr>
                                      {cols.map((c) => (
                                        <th key={c} className="px-2 py-1 text-left font-semibold">{c}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {preview.map((row, i) => (
                                      <tr key={i} className="even:bg-black/5/50 dark:even:bg-white/5/50">
                                        {cols.map((c) => (
                                          <td key={c} className="whitespace-pre-wrap px-2 py-1 align-top">
                                            {formatCell(row[c])}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
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


