import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-5 text-[#172026]">
      <div className="grid justify-items-center gap-4 rounded-lg border border-[#dfe4ea] bg-white px-8 py-7 shadow-sm">
        <LoaderCircle className="loading-spin text-[#255f85]" size={34} />
        <div className="text-center">
          <p className="font-semibold">Loading workspace</p>
          <p className="mt-1 text-sm text-[#667380]">Preparing live purchasing data...</p>
        </div>
      </div>
    </main>
  );
}
