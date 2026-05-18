import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Package, RotateCcw, Store, XCircle } from "lucide-react";

interface ProviderSummary {
  storesTotal: number;
  storesActive: number;
  storesInactive: number;
  todayOrders: number;
  todayConfirmed: number;
  todayReturned: number;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function ProviderDashboard() {
  const { data, isLoading } = useQuery<ProviderSummary>({
    queryKey: ["provider-summary"],
    queryFn: async () => {
      const res = await fetch("/api/provider/summary", { credentials: "include" });
      if (!res.ok) throw new Error("تعذر تحميل الملخص");
      return res.json();
    },
  });

  const today = new Date().toLocaleDateString("ar-DZ-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">نظرة عامة</h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-card border border-card-border rounded-lg p-5 h-20 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="إجمالي المتاجر" value={data.storesTotal} icon={Store} color="bg-primary/10 text-primary" />
          <StatCard label="متاجر نشطة" value={data.storesActive} icon={CheckCircle2} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
          <StatCard label="متاجر متوقفة" value={data.storesInactive} icon={XCircle} color="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" />
          <StatCard label="طلبات اليوم" value={data.todayOrders} icon={Package} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard label="مؤكدة اليوم" value={data.todayConfirmed} icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <StatCard label="مسترجعة اليوم" value={data.todayReturned} icon={RotateCcw} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
        </div>
      ) : null}
    </div>
  );
}
