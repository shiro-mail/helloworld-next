"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "./Toast";

const STORAGE_KEY = "uploaded-json";
const WORKING_ROWS_KEY = "working-rows-v1";
const COLUMNS = [
  "ページ",
  "出荷日",
  "受注番号",
  "納入先番号",
  "担当者",
  "運賃",
  "部品合計",
  "税抜合計",
] as const;

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function computePartsTotal(order: Record<string, unknown>): number | "" {
  // 形式A: 明細が配列/オブジェクト
  const legacy = order["明細"] as unknown;
  let total = 0;
  let counted = 0;
  const add = (qty: unknown, unit: unknown) => {
    const q = Number(qty);
    const u = Number(unit);
    if (Number.isFinite(q) && Number.isFinite(u)) {
      total += q * u;
      counted += 1;
    }
  };
  if (Array.isArray(legacy)) {
    for (const d of legacy) {
      if (typeof d === "object" && d !== null) {
        const rec = d as Record<string, unknown>;
        add(rec["数量"], rec["売上単価"]);
      }
    }
  } else if (typeof legacy === "object" && legacy !== null) {
    const rec = legacy as Record<string, unknown>;
    add(rec["数量"], rec["売上単価"]);
  }
  // 形式B: 各項目が配列
  const qtys = Array.isArray(order["数量"]) ? (order["数量"] as unknown[]) : [];
  const units = Array.isArray(order["売上単価"]) ? (order["売上単価"] as unknown[]) : [];
  const len = Math.max(qtys.length, units.length);
  for (let i = 0; i < len; i++) {
    add(qtys[i], units[i]);
  }
  return counted > 0 ? total : "";
}

function computeTaxTotal(order: Record<string, unknown>): number | "" {
  const parts = computePartsTotal(order);
  const freightNum = Number(order["運賃"]);
  let counted = 0;
  let total = 0;
  if (Number.isFinite(freightNum)) {
    total += freightNum;
    counted++;
  }
  if (typeof parts === "number" && Number.isFinite(parts)) {
    total += parts;
    counted++;
  }
  return counted > 0 ? total : "";
}

function pickSevenFromOrder(order: Record<string, unknown>): Row {
  const out: Row = {};
  for (const k of COLUMNS) {
    if (k === "ページ") {
      out[k] = (order[k as string] ?? "") as unknown;
    } else if (k === "部品合計") {
      out[k] = computePartsTotal(order);
    } else if (k === "税抜合計") {
      out[k] = computeTaxTotal(order);
    } else {
      out[k] = order[k as string];
    }
  }
  return out;
}

function parseKeyValueListString(text: string): Row | null {
  const tryParseArray = () => {
    try {
      const parsed = JSON.parse(text);
      if (isRecord(parsed)) {
        return parsed as Row;
      }
      if (!Array.isArray(parsed)) return null;
      const obj: Row = {};
      for (const item of parsed) {
        if (typeof item !== "string") continue;
        const token = String(item)
          .trim()
          .replace(/^['\"]/g, "")
          .replace(/['\"]$/g, "");
        const sep = token.match(/[:＝：=]/)?.index ?? -1;
        if (sep === -1) continue;
        const key = token.slice(0, sep).trim();
        const value = token.slice(sep + 1).trim();
        if (key) obj[key] = value.replace(/^['\"]/g, "").replace(/['\"]$/g, "");
      }
      return Object.keys(obj).length ? obj : null;
    } catch {
      return null;
    }
  };

  const fromArray = tryParseArray();
  if (fromArray) return fromArray;
  return null;
}

function normalize(json: unknown): Row[] {
  // 先頭に text キーがある場合は、その内容を優先的に展開
  if (isRecord(json) && Object.prototype.hasOwnProperty.call(json, "text")) {
    const wrapper = json as Record<string, unknown>;
    const content = wrapper.text as unknown;
    if (typeof content === "string") {
      // まずは text が厳密な JSON かを試す（配列/オブジェクトどちらも対応）
      try {
        const parsedJson = JSON.parse(content);
        // 配列 → 各要素をオーダーとして扱う
        if (Array.isArray(parsedJson)) {
          const out: Row[] = [];
          for (const item of parsedJson) {
            if (isRecord(item)) out.push(pickSevenFromOrder({ ...item, ...wrapper }));
          }
          if (out.length) return out;
        }
        // オブジェクト → 単一オーダー
        if (isRecord(parsedJson)) {
          return [pickSevenFromOrder({ ...parsedJson, ...wrapper })];
        }
      } catch {
        // no-op → 文字列パーサにフォールバック
      }
      const parsed = parseKeyValueListString(content);
      if (parsed) {
        const merged: Record<string, unknown> = { ...parsed, ...wrapper };
        return [pickSevenFromOrder(merged)];
      }
      return [];
    }
    if (Array.isArray(content)) {
      const out: Row[] = [];
      for (const item of content) {
        if (isRecord(item)) out.push(pickSevenFromOrder({ ...item, ...wrapper }));
        else if (typeof item === "string") {
          const parsed = parseKeyValueListString(item);
          if (parsed) out.push(pickSevenFromOrder({ ...parsed, ...wrapper }));
        }
      }
      if (out.length) return out;
    }
    if (isRecord(content)) {
      return [pickSevenFromOrder({ ...content, ...wrapper })];
    }
    // ここまでで確定しない場合は通常処理へフォールバック
  }
  // 1) 期待構造: 注文配列（明細は無視）
  if (Array.isArray(json)) {
    const out: Row[] = [];
    for (const item of json) {
      if (isRecord(item)) {
        // text を持つ要素は text を解析し、元の要素のキー（例: ページ）もマージ
        const itemRec = item as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(itemRec, "text") && typeof itemRec.text === "string") {
          const parsed = parseKeyValueListString(String(itemRec.text));
          if (parsed) out.push(pickSevenFromOrder({ ...parsed, ...itemRec }));
        } else {
          out.push(pickSevenFromOrder(itemRec));
        }
      } else if (typeof item === "string") {
        const parsed = parseKeyValueListString(item);
        if (parsed) out.push(pickSevenFromOrder(parsed));
      }
    }
    return out;
  }
  // 2) 単一オブジェクト
  if (isRecord(json)) {
    return [pickSevenFromOrder(json)];
  }
  return [];
}

export default function SevenFieldsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const masterRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const load = () => {
    // 1) 作業用の行が保存されていれば優先
    try {
      const working = localStorage.getItem(WORKING_ROWS_KEY);
      if (working) {
        const arr = JSON.parse(working);
        if (Array.isArray(arr)) {
          setRows(arr as Row[]);
          return;
        }
      }
    } catch {}
    // 2) 生JSONから正規化して行を生成
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return setRows([]);
    try {
      const json = JSON.parse(text);
      const normalized = normalize(json);
      setRows(normalized);
      try {
        localStorage.setItem(WORKING_ROWS_KEY, JSON.stringify(normalized));
      } catch {}
    } catch {
      setRows([]);
    }
  };

  const handleClearAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(WORKING_ROWS_KEY);
      setRows([]);
      window.dispatchEvent(new Event("uploaded-json-changed"));
      showToast("全データを削除しました", "success");
    } catch {
      setRows([]);
    }
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem(WORKING_ROWS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleOpenParts = (index: number) => {
    try {
      localStorage.setItem("selected-row", JSON.stringify(rows[index] ?? {}));
    } catch {}
    router.push(`/detail?i=${index}`);
  };

  const handleEditOpen = (index: number) => {
    const current = rows[index];
    const obj: Record<string, string> = {};
    for (const k of COLUMNS as unknown as string[]) {
      obj[k] = current?.[k] !== undefined && current?.[k] !== null ? String(current[k]) : "";
    }
    setForm(obj);
    setEditingIndex(index);
    setIsEditing(true);
  };

  const handleEditChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditSave = () => {
    if (editingIndex === null) return;
    setRows((prev) => {
      const next = [...prev];
      const updated: Row = {};
      for (const k of COLUMNS as unknown as string[]) {
        updated[k] = form[k] ?? "";
      }
      next[editingIndex] = updated;
      try {
        localStorage.setItem(WORKING_ROWS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setIsEditing(false);
    setEditingIndex(null);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditingIndex(null);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("uploaded-json-changed", handler);
    return () => window.removeEventListener("uploaded-json-changed", handler);
  }, []);

  const columns = useMemo(() => [...COLUMNS] as string[], []);

  // 一括チェックの indeterminate 表示
  useEffect(() => {
    if (!masterRef.current) return;
    const size = selected.size;
    masterRef.current.indeterminate = size > 0 && size < rows.length;
  }, [selected, rows.length]);

  // 入れ替わり時の初期化（必要に応じて）
  useEffect(() => {
    // 新しいデータ読み込み時は選択をリセット
    setSelected(new Set());
  }, [rows]);

  // 一括選択UIは削除済みのため、関数は不要

  // 使っていないヘルパーは削除（不要警告の解消）

  if (rows.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <p className="opacity-70">JSONを読み込むとここに表示されます。</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-2 flex items-center justify-end gap-3">
        <Link
          href="/saves"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          データ一覧
        </Link>
        <button
          onClick={handleClearAll}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-white hover:opacity-90"
        >
          読込データ全削除
        </button>
        <button
          onClick={async () => {
            try {
              const selectedRows = rows.filter((_, i) => selected.has(i));
              if (selectedRows.length === 0) {
                showToast("選択された行がありません。チェックを入れてください。", "info");
                return;
              }
              const payload = {
                raw: JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
                rows: selectedRows,
              };
              const res = await fetch("/api/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!res.ok) throw new Error("保存に失敗しました");
              // 保存成功: 選択されていない行は残す
              const remaining = rows.filter((_, i) => !selected.has(i));
              setRows(remaining);
              setSelected(new Set());
              try {
                localStorage.setItem(WORKING_ROWS_KEY, JSON.stringify(remaining));
              } catch {}
              showToast(`選択した ${selectedRows.length} 行を保存しました。未選択の行は残しています。`, "success");
            } catch (e) {
              showToast((e as Error).message, "error");
            }
          }}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:opacity-90"
        >
          データベースに保存
        </button>

      </div>
      <div className="overflow-auto rounded-xl border border-black/10 dark:border-white/20">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/5">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold">
                {col}
              </th>
            ))}
              <th className="px-3 py-2 text-left font-semibold">操作</th>
              <th className="px-3 py-2 text-left font-semibold">選択</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="even:bg-black/5/50 dark:even:bg-white/5/50">
              {columns.map((col) => (
                <td key={col} className="whitespace-pre-wrap px-3 py-2 align-top">
                  {formatCell(row[col])}
                </td>
              ))}
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenParts(idx)} className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:opacity-90">部品詳細</button>
                    <button onClick={() => handleEditOpen(idx)} className="rounded-md bg-sky-600 px-3 py-1 text-white hover:opacity-90">編集</button>
                    <button onClick={() => handleDeleteRow(idx)} className="rounded-md bg-rose-600 px-3 py-1 text-white hover:opacity-90">削除</button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(idx)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(idx); else next.delete(idx);
                        return next;
                      });
                    }}
                    className="h-4 w-4"
                  />
                </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">行を編集</h2>
              <button onClick={handleEditCancel} className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">閉じる</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(COLUMNS as unknown as string[]).map((col) => (
                <label key={col} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium opacity-80">{col}</span>
                  <input
                    value={form[col] ?? ""}
                    onChange={(e) => handleEditChange(col, e.target.value)}
                    className="rounded-md border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-sky-400 dark:border-white/20"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={handleEditCancel} className="rounded-md border px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">キャンセル</button>
              <button onClick={handleEditSave} className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:opacity-90">保存</button>
            </div>
          </div>
        </div>
      )}
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


