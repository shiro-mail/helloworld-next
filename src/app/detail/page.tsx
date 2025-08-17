"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "uploaded-json";

type AnyRecord = Record<string, unknown>;

function isRecord(u: unknown): u is AnyRecord {
  return typeof u === "object" && u !== null && !Array.isArray(u);
}

function findOrder(raw: unknown, selected: AnyRecord | null): AnyRecord | null {
  if (!selected) return null;
  const idKeys = ["受注番号", "納入先番号", "出荷日"];

  const matches = (row: AnyRecord): boolean => {
    return idKeys.every((k) => selected[k] ? row[k] === selected[k] : true);
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isRecord(item)) {
        if (matches(item)) return item;
        if (isRecord(item.text) && matches(item.text as AnyRecord)) return item.text as AnyRecord;
        if (typeof (item as any).text === "string") {
          try {
            const parsed = JSON.parse((item as any).text as string);
            if (Array.isArray(parsed)) {
              for (const p of parsed) if (isRecord(p) && matches(p)) return p;
            } else if (isRecord(parsed) && matches(parsed)) {
              return parsed;
            }
          } catch {}
        }
      }
    }
  } else if (isRecord(raw)) {
    if (matches(raw)) return raw;
    if (isRecord(raw.text) && matches(raw.text as AnyRecord)) return raw.text as AnyRecord;
    if (typeof raw.text === "string") {
      try {
        const parsed = JSON.parse(raw.text as string);
        if (Array.isArray(parsed)) {
          for (const p of parsed) if (isRecord(p) && matches(p)) return p;
        } else if (isRecord(parsed) && matches(parsed)) {
          return parsed;
        }
      } catch {}
    }
  }
  return null;
}

function getPartsForRow(raw: unknown, rowIndex: number | null, selectedRow: AnyRecord | null): AnyRecord | null {
  if (rowIndex !== null && raw && Array.isArray(raw)) {
    if (rowIndex >= 0 && rowIndex < raw.length) {
      const order = raw[rowIndex] as AnyRecord;
      if (isRecord(order)) {
        const hasPartsData = Array.isArray(order["部品番号"]) || Array.isArray(order["部品名"]) || 
                            Array.isArray(order["数量"]) || Array.isArray(order["売上単価"]) ||
                            Array.isArray(order["明細"]) || isRecord(order["明細"]);
        if (hasPartsData) {
          return order;
        }
      }
    }
  }
  
  return findOrder(raw, selectedRow);
}


function toDetails(order: AnyRecord): AnyRecord[] {
  // 形式A: 明細キーがある（後方互換）
  const legacy = order["明細"];
  if (Array.isArray(legacy)) {
    return legacy.flatMap((d) => (isRecord(d) ? [d] : []));
  }
  if (isRecord(legacy)) {
    return [legacy];
  }

  // 形式B: 各項目が配列で横並び対応
  const nos = Array.isArray(order["部品番号"]) ? (order["部品番号"] as unknown[]) : [];
  const names = Array.isArray(order["部品名"]) ? (order["部品名"] as unknown[]) : [];
  const qtys = Array.isArray(order["数量"]) ? (order["数量"] as unknown[]) : [];
  const units = Array.isArray(order["売上単価"]) ? (order["売上単価"] as unknown[]) : [];
  const len = Math.max(nos.length, names.length, qtys.length, units.length);
  if (len === 0) return [];
  const rows: AnyRecord[] = [];
  for (let i = 0; i < len; i++) {
    const 数量 = qtys[i];
    const 売上単価 = units[i];
    rows.push({
      部品番号: nos[i],
      部品名: names[i],
      数量,
      売上単価,
      売上金額: calcAmount(数量, 売上単価),
    });
  }
  return rows;
}

export default function DetailPage() {
  const params = useSearchParams();
  const [raw, setRaw] = useState<unknown>(null);
  const [rowIndex, setRowIndex] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<AnyRecord | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<{ 部品番号: string; 部品名: string; 数量: string; 売上単価: string }>({
    部品番号: "",
    部品名: "",
    数量: "",
    売上単価: "",
  });

  useEffect(() => {
    const indexParam = params.get("i");
    setRowIndex(indexParam ? parseInt(indexParam, 10) : null);
    
    try {
      const row = localStorage.getItem("selected-row");
      setSelectedRow(row ? (JSON.parse(row) as AnyRecord) : null);
    } catch {}
    
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      setRaw(text ? JSON.parse(text) : null);
    } catch {}
  }, [params]);

  const details = useMemo(() => {
    const order = getPartsForRow(raw, rowIndex, selectedRow);
    if (!order) return [];
    
    const parts = toDetails(order);
    
    return parts.map((d: AnyRecord) => ({
      部品番号: d["部品番号"],
      部品名: d["部品名"],
      数量: d["数量"],
      売上単価: d["売上単価"],
      売上金額: calcAmount(d["数量"], d["売上単価"]),
    }));
  }, [raw, rowIndex, selectedRow]);

  const totalAmount = useMemo(() => {
    return details.reduce((sum: number, d: AnyRecord) => {
      const n = Number(d["売上金額"]);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  }, [details]);

  const setLocalRaw = (next: unknown) => {
    setRaw(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const withCloned = (value: unknown): unknown => {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  };

  const modifyTargetOrder = (modifier: (order: AnyRecord) => void) => {
    const cloned = withCloned(raw);
    
    if (rowIndex !== null && Array.isArray(cloned) && rowIndex >= 0 && rowIndex < cloned.length) {
      const order = cloned[rowIndex] as AnyRecord;
      if (isRecord(order)) {
        const hasPartsData = Array.isArray(order["部品番号"]) || Array.isArray(order["部品名"]) || 
                            Array.isArray(order["数量"]) || Array.isArray(order["売上単価"]) ||
                            Array.isArray(order["明細"]) || isRecord(order["明細"]);
        if (hasPartsData) {
          modifier(order);
          setLocalRaw(cloned);
          return;
        }
      }
    }
    
    if (!selectedRow) return;
    const idKeys = ["受注番号", "納入先番号", "出荷日"];
    const matches = (row: AnyRecord): boolean => {
      return idKeys.every((k) => (selectedRow[k] ? row[k] === selectedRow[k] : true));
    };

    if (Array.isArray(cloned)) {
      for (const item of cloned) {
        if (isRecord(item) && matches(item)) {
          modifier(item);
          setLocalRaw(cloned);
          return;
        }
        if (isRecord(item) && isRecord(item.text) && matches(item.text as AnyRecord)) {
          modifier(item.text as AnyRecord);
          setLocalRaw(cloned);
          return;
        }
      }
    } else if (isRecord(cloned)) {
      if (matches(cloned)) {
        modifier(cloned);
        setLocalRaw(cloned);
        return;
      }
      if (isRecord(cloned.text) && matches(cloned.text as AnyRecord)) {
        modifier(cloned.text as AnyRecord);
        setLocalRaw(cloned);
        return;
      }
    }
  };

  const handleDelete = (index: number) => {
    if (rowIndex === null) return;
    modifyTargetOrder((order) => {
      const legacy = order["明細"];
      if (Array.isArray(legacy)) {
        (order["明細"] as unknown[]) = legacy.filter((_, i) => i !== index);
        return;
      }
      if (isRecord(legacy)) {
        order["明細"] = [] as unknown[];
        return;
      }
      
      const keys = ["部品番号", "部品名", "数量", "売上単価", "売上金額"] as const;
      for (const k of keys) {
        if (Array.isArray(order[k])) {
          (order[k] as unknown[]) = (order[k] as unknown[]).filter((_, i) => i !== index);
        }
      }
    });
  };

  const openEdit = (index: number) => {
    const row = details[index];
    setForm({
      部品番号: row?.部品番号 !== undefined && row?.部品番号 !== null ? String(row.部品番号) : "",
      部品名: row?.部品名 !== undefined && row?.部品名 !== null ? String(row.部品名) : "",
      数量: row?.数量 !== undefined && row?.数量 !== null ? String(row.数量) : "",
      売上単価: row?.売上単価 !== undefined && row?.売上単価 !== null ? String(row.売上単価) : "",
    });
    setEditingIndex(index);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const idx = editingIndex;
    
    const calculatedAmount = calcAmount(form.数量, form.売上単価);
    
    modifyTargetOrder((order) => {
      const legacy = order["明細"];
      if (Array.isArray(legacy)) {
        const target = legacy[idx];
        if (isRecord(target)) {
          target["部品番号"] = form.部品番号;
          target["部品名"] = form.部品名;
          target["数量"] = form.数量;
          target["売上単価"] = form.売上単価;
          target["売上金額"] = calculatedAmount;
        }
        return;
      }
      
      const keys = ["部品番号", "部品名", "数量", "売上単価", "売上金額"] as const;
      for (const k of keys) {
        if (Array.isArray(order[k])) {
          const arr = order[k] as unknown[];
          arr[idx] = form[k as keyof typeof form] as unknown;
        }
      }
      
      if (Array.isArray(order["売上金額"])) {
        const amountArr = order["売上金額"] as unknown[];
        amountArr[idx] = calculatedAmount;
      }
    });
    
    setIsEditing(false);
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingIndex(null);
  };

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">部品詳細</h1>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
          ← 戻る
        </Link>
      </div>

      {details.length === 0 ? (
        <p className="opacity-70">該当データの明細が見つかりませんでした。</p>
      ) : (
        <div className="w-full max-w-6xl mx-auto overflow-auto rounded-xl border border-black/10 dark:border-white/20">
          <div className="flex justify-end px-3 py-2 text-sm font-semibold">
            売上金額 合計: {totalAmount}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">部品番号</th>
                <th className="px-3 py-2 text-left font-semibold">部品名</th>
                <th className="px-3 py-2 text-left font-semibold">数量</th>
                <th className="px-3 py-2 text-left font-semibold">売上単価</th>
                <th className="px-3 py-2 text-left font-semibold">売上金額</th>
                <th className="px-3 py-2 text-left font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d: AnyRecord, i: number) => (
                <tr key={i} className="even:bg-black/5/50 dark:even:bg-white/5/50">
                  <td className="px-3 py-2">{formatCell(d["部品番号"])}</td>
                  <td className="px-3 py-2">{formatCell(d["部品名"])}</td>
                  <td className="px-3 py-2">{formatCell(d["数量"])}</td>
                  <td className="px-3 py-2">{formatCell(d["売上単価"])}</td>
                  <td className="px-3 py-2">{formatCell(d["売上金額"])}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(i)} className="rounded-md bg-sky-600 px-3 py-1 text-white hover:opacity-90">編集</button>
                      <button onClick={() => handleDelete(i)} className="rounded-md bg-rose-600 px-3 py-1 text-white hover:opacity-90">削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">部品行を編集</h2>
              <button onClick={cancelEdit} className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">閉じる</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["部品番号", "部品名", "数量", "売上単価"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium opacity-80">{k}</span>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="rounded-md border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-sky-400 dark:border-white/20"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={cancelEdit} className="rounded-md border px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">キャンセル</button>
              <button onClick={saveEdit} className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:opacity-90">保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function calcAmount(qty: unknown, unit: unknown): number | string {
  const q = Number(qty);
  const u = Number(unit);
  if (Number.isFinite(q) && Number.isFinite(u)) return q * u;
  return "";
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


