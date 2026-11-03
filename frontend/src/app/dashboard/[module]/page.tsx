import { Suspense } from "react";
import ModuleContent from "./ModuleContent";

export default function ModulePlaceholderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-xs text-gray-500">
          Loading...
        </div>
      }
    >
      <ModuleContent />
    </Suspense>
  );
}
