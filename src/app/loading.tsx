import { LoadingWordmark } from "@/app/loading-controls";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-5 text-[#172026]">
      <div className="global-loading-panel">
        <LoadingWordmark />
        <span className="global-loading-line" />
      </div>
    </main>
  );
}
