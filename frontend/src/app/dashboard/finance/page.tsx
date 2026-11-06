import { Suspense } from "react";
import ModuleContent from "../[module]/ModuleContent";

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-xs text-gray-500">
          Loading Finance Module...
        </div>
      }
    >
      <ModuleContent />
    </Suspense>
  );
}

