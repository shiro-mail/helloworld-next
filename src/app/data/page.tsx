"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "uploaded-json";
const PREFERRED_COLUMNS = [
  "出荷日",
  "受注番号",
  "納入先番号",
  "担当者",
  "運賃",
  "税抜合計",
  "税抜合計(算出)",
] as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripOuterBrackets(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return text;
}

function parseKeyValueListString(text: string): JsonRecord | null {
  // 入力例: ["出荷日:2025/07/10","受注番号:1002889", ...]
  // もしくは: ["出荷日":"2025/07/10", "受注番号":"1002889", ...]
  try {
    // まずは JSON として配列にパースを試みる
    const maybeArray = JSON.parse(text);
    if (Array.isArray(maybeArray)) {
      const obj: JsonRecord = {};
      for (const item of maybeArray) {
        if (typeof item !== "string") continue;
        const token = item.trim().replace(/^['\"]/g, "").replace(/['\"]$/g, "");
        const sepMatch = token.match(/[:＝：=]/);
        if (!sepMatch) continue;
        const sepIndex = sepMatch.index ?? -1;
        if (sepIndex === -1) continue;
        const key = token
          .slice(0, sepIndex)
          .replace(/^['\"]/g, "")
          .replace(/['\"]$/g, "")
          .trim();
        const value = token
          .slice(sepIndex + 1)
          .replace(/^['\"]/g, "")
          .replace(/['\"]$/g, "")
          .trim();
        if (key) obj[key] = value;
      }
      if (Object.keys(obj).length > 0) return obj;
    }
  } catch {
    // JSON.parse に失敗した場合は、手動で分割
    const body = stripOuterBrackets(text);
    const parts = body
      .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/) // クォート外のカンマで分割
      .map((p) => p.trim().replace(/^['\"]/g, "").replace(/['\"]$/g, ""))
      .filter(Boolean);
    const obj: JsonRecord = {};
    for (const part of parts) {
      const sepMatch = part.match(/[:＝：=]/);
      const sepIndex = sepMatch?.index ?? -1;
      if (sepIndex === -1) continue;
      const key = part
        .slice(0, sepIndex)
        .replace(/^['\"]/g, "")
        .replace(/['\"]$/g, "")
        .trim();
      const value = part
        .slice(sepIndex + 1)
        .replace(/^['\"]/g, "")
        .replace(/['\"]$/g, "")
        .trim();
      if (key) obj[key] = value;
    }
    if (Object.keys(obj).length > 0) return obj;
  }
  return null;
}

function flattenOrdersToDetailRows(value: unknown): JsonRecord[] {
  // 今回は「明細なし」。オーダー単位を1行として、指定の7項目のみ抽出。
  const orders: unknown[] = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  const rows: JsonRecord[] = [];
  for (const order of orders) {
    if (!isRecord(order)) continue;
    rows.push({
      出荷日: order["出荷日"],
      受注番号: order["受注番号"],
      納入先番号: order["納入先番号"],
      担当者: order["担当者"],
      運賃: order["運賃"],
      税抜合計: order["税抜合計"],
      "税抜合計(算出)": order["税抜合計(算出)"],
    });
  }
  return rows;
}

function pickFixedColumns(obj: Record<string, unknown>): JsonRecord {
  const picked: JsonRecord = {};
  for (const key of PREFERRED_COLUMNS) {
    picked[key as string] = obj[key as string];
  }
  return picked;
}

function extractOrderRow(u: unknown): JsonRecord | null {
  if (isRecord(u)) {
    // そのままキーがあれば抽出
    const hasAny = PREFERRED_COLUMNS.some((k) => Object.prototype.hasOwnProperty.call(u, k as string));
    if (hasAny) return pickFixedColumns(u);
    // textフィールドにキー:値が並んでいるケース
    if (typeof u.text === "string") {
      const parsed = parseKeyValueListString(u.text);
      if (parsed) return pickFixedColumns(parsed);
    }
    return null;
  }
  if (typeof u === "string") {
    const parsed = parseKeyValueListString(u);
    if (parsed) return pickFixedColumns(parsed);
  }
  return null;
}

function normalizeToRows(value: unknown): JsonRecord[] {
  // 1) 配列のオブジェクト → そのまま
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "object" && v !== null)) {
      return value as JsonRecord[];
    }
    // 2) 配列の文字列 → 各要素を key:value 群として解釈できるなら変換
    if (value.every((v) => typeof v === "string")) {
      const converted: JsonRecord[] = [];
      for (const s of value as string[]) {
        const obj = parseKeyValueListString(s);
        if (obj) converted.push(pickFixedColumns(obj));
        else converted.push({ value: s });
      }
      return converted;
    }
    // 3) 配列の配列 → インデックス列を作成
    if (value.every((v) => Array.isArray(v))) {
      return (value as unknown[]).map((arr) => {
        const record: JsonRecord = {};
        (arr as unknown[]).forEach((cell, i) => {
          record[`col_${i + 1}`] = cell as unknown;
        });
        return record;
      });
    }
  }

  // 4) オブジェクト単体
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    // 単一キー text の場合の特別処理
    if (Object.keys(obj).length === 1 && typeof obj.text === "string") {
      const parsed = parseKeyValueListString(String(obj.text));
      if (parsed) return [pickFixedColumns(parsed)];
    }
    const extracted = extractOrderRow(obj);
    if (extracted) return [extracted];
    return [pickFixedColumns(obj)];
  }

  // 5) 文字列 → key:value 群として解釈を試みる
  if (typeof value === "string") {
    const parsed = parseKeyValueListString(value);
    if (parsed) return [pickFixedColumns(parsed)];
    return [{ value }];
  }

  return [];
}

export default function DataPage() {
  const [rows, setRows] = useState<JsonRecord[]>([]);

  useEffect(() => {
    const text = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!text) return;
    try {
      const json = JSON.parse(text);
      const flattened = flattenOrdersToDetailRows(json);
      if (flattened.length > 0) {
        setRows(flattened);
      } else {
        setRows(normalizeToRows(json));
      }
    } catch {}
  }, []);

  const columns = useMemo(() => {
    return [...PREFERRED_COLUMNS] as unknown as string[];
  }, []);

  const handleDelete = (index: number) => {
    // 今回はUI表示のみ削除（永続化は行わない）
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    // ここでは簡易的にアラート表示。実アプリではモーダルや編集フォームに置換可。
    const row = rows[index];
    alert(`編集: ${JSON.stringify(row, null, 2)}`);
  };

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">データ一覧</h1>
        <Link
          href="/"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          ← 戻る
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="opacity-70">データがありません。トップページでJSONファイルを読み込んでください。</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-black/10 dark:border-white/20">
          <table className="min-w-full text-sm">
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
              {rows.map((row, idx) => (
                <tr key={idx} className="even:bg-black/5/50 dark:even:bg-white/5/50">
                  {columns.map((col) => (
                    <td key={col} className="whitespace-pre-wrap px-3 py-2 align-top">
                      {formatCell(row[col])}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(idx)}
                        className="rounded-md bg-sky-600 px-3 py-1 text-white hover:opacity-90"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(idx)}
                        className="rounded-md bg-rose-600 px-3 py-1 text-white hover:opacity-90"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
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


