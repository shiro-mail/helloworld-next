import JsonLoader from "./components/JsonLoader";
import SevenFieldsTable from "./components/SevenFieldsTable";
import PngLoader from "./components/PngLoader";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-start gap-8 p-8 pt-12">
      <h1 className="w-full text-center text-3xl sm:text-4xl font-extrabold tracking-tight text-sky-600">
        仕入管理システム
      </h1>
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid w-full grid-cols-1 items-start gap-6 md:grid-cols-2">
          <JsonLoader />
          <PngLoader />
        </div>
        <div className="mt-6">
          <SevenFieldsTable />
        </div>
      </div>
    </main>
  );
}
