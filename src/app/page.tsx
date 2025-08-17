import JsonLoader from "./components/JsonLoader";
import SevenFieldsTable from "./components/SevenFieldsTable";
import PngLoader from "./components/PngLoader";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-start gap-8 p-8 pt-12">
      <div className="relative w-full max-w-6xl mx-auto">
        <h1 className="w-full text-center text-3xl sm:text-4xl font-extrabold tracking-tight text-sky-600">
          仕入管理システム Ver1.0
        </h1>
        <Link
          href="/saves"
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md border px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          データ一覧
        </Link>
      </div>
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid w-full grid-cols-1 items-start gap-6 md:grid-cols-2">
          <div>
            <JsonLoader />
          </div>
          <div className="flex w-full flex-col items-end gap-2">
            <PngLoader />
          </div>
        </div>
        <div className="mt-6">
          <SevenFieldsTable />
        </div>
      </div>
    </main>
  );
}
