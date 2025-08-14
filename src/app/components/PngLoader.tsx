"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "./Toast";

export default function PngLoader() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast, dismiss } = useToast();

  const handleOpenPicker = useCallback(() => inputRef.current?.click(), []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    const pngs = selected.filter((f) => f.type === "image/png" || f.name.toLowerCase().endsWith(".png"));
    setFiles(pngs);
    e.target.value = "";
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const selected = Array.from(e.dataTransfer.files || []);
    const pngs = selected.filter((f) => f.type === "image/png" || f.name.toLowerCase().endsWith(".png"));
    setFiles(pngs);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <section className="w-full max-w-xl">
      <div
        onClick={handleOpenPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "cursor-pointer rounded-xl border-2 border-dashed p-8 transition-colors",
          isDragging
            ? "border-violet-400 bg-violet-400/10"
            : "border-black/10 dark:border-white/20 hover:border-violet-300",
        ].join(" ")}
        aria-label="PNGファイルを選択またはドロップ"
        role="button"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-lg font-semibold">PNGファイルを選択（複数可）</div>
          <div className="text-sm opacity-70">ドラッグ＆ドロップ、またはクリックしてファイルを選択</div>
          <button
            type="button"
            className="mt-2 rounded-md bg-foreground px-4 py-2 text-background hover:opacity-90"
          >
            ファイルを開く
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png"
          multiple
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-sm opacity-70">選択中: {files.length}件</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {files.map((file, idx) => {
              const url = URL.createObjectURL(file);
              return (
                <figure key={idx} className="overflow-hidden rounded-lg border border-black/10 dark:border-white/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={file.name} className="h-28 w-full object-contain bg-black/5 dark:bg-white/5" />
                  <figcaption className="truncate px-2 py-1 text-xs opacity-80">{file.name}</figcaption>
                </figure>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={isProcessing}
              onClick={async () => {
                try {
                  setIsProcessing(true);
                  const fd = new FormData();
                  files.forEach((f) => fd.append("files", f));
                  const res = await fetch("/api/dify/upload", {
                    method: "POST",
                    body: fd,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || "アップロードに失敗しました");
                  // Difyのレスポンスから file_id を抽出（仕様に応じて調整）
                  const ids = (data?.results || [])
                    .map((r: any) => r?.data?.id || r?.id || r?.data?.file_id || r?.file_id)
                    .filter(Boolean);
                  setFileIds(ids);
                  try { localStorage.setItem("dify_file_ids", JSON.stringify(ids)); } catch {}
                  // アップロード完了のタイミングで分析開始トースト（自動消滅なし）
                  const analyzingId = showToast("Difyで分析中...", "info", { durationMs: 0 });
                  // 画像file_idsとJSON/rowsを使ってDifyワークフローを即実行
                  try {
                    const payload = {
                      inputs: {
                        order_json: JSON.parse(localStorage.getItem("uploaded-json") || "null"),
                        working_rows: JSON.parse(localStorage.getItem("working-rows-v1") || "[]"),
                        input_file: ids.map((id: string) => ({
                          type: "image",
                          transfer_method: "local_file",
                          upload_file_id: id,
                        })),
                      },
                      response_mode: "blocking",
                      user: "purchases-maintenance-app",
                    };
                    const runRes = await fetch("/api/dify/run", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    const runData = await runRes.json();
                    if (!runRes.ok) throw new Error(runData?.error || "Dify実行に失敗しました");
                    const text = extractDifyText(runData);
                    if (typeof text === "string") {
                      localStorage.setItem("uploaded-json", JSON.stringify({ text }));
                      localStorage.removeItem("working-rows-v1");
                      window.dispatchEvent(new Event("uploaded-json-changed"));
                      // 成功したらプレビュー/ボタンと file_ids をクリア
                      try { localStorage.removeItem("dify_file_ids"); } catch {}
                      setFiles([]);
                      setFileIds([]);
                      // 分析中トーストを閉じてから成功トースト
                      setTimeout(() => {
                        try { dismiss(analyzingId); } catch {}
                      }, 0);
                      setTimeout(() => showToast("処理が完了し、結果を読み込みました。", "success"), 50);
                    } else {
                      setTimeout(() => showToast("Dify実行は成功しましたが、textフィールドが見つかりませんでした。", "info"), 50);
                      console.log("[Dify Result]", runData);
                    }
                  } catch (e) {
                    showToast((e as Error).message, "error");
                  }
                } catch (e) {
                  showToast((e as Error).message, "error");
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:opacity-90 disabled:opacity-50"
            >
              {isProcessing ? "実行中…" : "Difyへアップロード"}
            </button>
            {fileIds.length > 0 && (
              <div className="self-center text-xs opacity-70">file_ids: {fileIds.join(", ")}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function extractDifyText(data: any): string | null {
  if (!data) return null;
  const candidates = [
    data?.text,
    data?.data?.text,
    data?.data?.outputs?.text,
    data?.outputs?.text,
    data?.result,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

// 軽い全画面インジケーター（必要に応じて有効化）
// {isProcessing && (
//   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
//     <div className="flex flex-col items-center gap-3 rounded-xl bg-background p-6">
//       <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
//       <div className="text-sm opacity-80">実行中…</div>
//     </div>
//   </div>
// )}


