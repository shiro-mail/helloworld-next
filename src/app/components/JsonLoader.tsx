"use client";

import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "uploaded-json";

export default function JsonLoader() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const resetState = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    resetState();
    if (!file.name.toLowerCase().endsWith(".json")) {
      setErrorMessage("JSONファイルを選択してください (.json)");
      return;
    }
    try {
      const text = await file.text();
      // JSONとして妥当か軽く検証して保存
      JSON.parse(text);
      localStorage.setItem(STORAGE_KEY, text);
      try {
        window.dispatchEvent(new Event("uploaded-json-changed"));
      } catch {}
    } catch (err) {
      setErrorMessage("JSONの解析に失敗しました。ファイル内容を確認してください。");
    }
  }, [resetState]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void parseFile(file);
      }
      // 連続で同じファイルを選べるように値をリセット
      e.target.value = "";
    },
    [parseFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void parseFile(file);
      }
    },
    [parseFile]
  );

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
    <section className="w-full max-w-4xl">
      <div
        onClick={handleOpenPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "cursor-pointer rounded-xl border-2 border-dashed p-8 transition-colors",
          isDragging
            ? "border-sky-400 bg-sky-400/10"
            : "border-black/10 dark:border-white/20 hover:border-sky-300",
        ].join(" ")}
        aria-label="JSONファイルを選択またはドロップ"
        role="button"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-lg font-semibold">JSONファイルを選択</div>
          <div className="text-sm opacity-70">
            Finderからドラッグ＆ドロップ、またはクリックしてファイルを選択
          </div>
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
          accept="application/json,.json"
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </section>
  );
}


