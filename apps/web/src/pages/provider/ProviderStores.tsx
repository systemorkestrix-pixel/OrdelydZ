import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProviderStore {
  id: number;
  name: string;
  slug: string;
  ownerName: string;
  phone: string;
  city: string;
  isActive: boolean;
  merchantEmail: string | null;
  ordersCount: number;
  createdAt: string;
}

interface CreateStoreResponse {
  store: ProviderStore;
  merchantPassword: string;
}

const inputCls = "w-full h-9 bg-background border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right";
const headCell = "border border-border px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap";
const bodyCell = "border border-border px-4 py-3.5 align-middle";

export default function ProviderStores() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createdPassword, setCreatedPassword] = useState("");
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [form, setForm] = useState({
    storeName: "",
    ownerName: "",
    phone: "",
    city: "الجزائر",
    merchantEmail: "",
    merchantPassword: "",
  });

  const queryKey = ["provider-stores"];
  const { data: stores = [], isLoading } = useQuery<ProviderStore[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/provider/stores", { credentials: "include" });
      if (!res.ok) throw new Error("تعذر تحميل المتاجر");
      return res.json();
    },
  });

  const createStore = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/provider/stores", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "تعذر إنشاء المتجر");
      }
      return res.json() as Promise<CreateStoreResponse>;
    },
    onSuccess: (data) => {
      qc.setQueryData<ProviderStore[]>(queryKey, (current = []) => [data.store, ...current]);
      setCreatedPassword(data.merchantPassword);
      setVisiblePassword(false);
      setForm({ storeName: "", ownerName: "", phone: "", city: "الجزائر", merchantEmail: "", merchantPassword: "" });
      toast({ title: "تم إنشاء المتجر" });
    },
    onError: (error) => {
      toast({ title: error instanceof Error ? error.message : "تعذر إنشاء المتجر", variant: "destructive" });
    },
  });

  const updateStore = useMutation({
    mutationFn: async ({ store, isActive }: { store: ProviderStore; isActive: boolean }) => {
      const res = await fetch(`/api/provider/stores/${store.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("تعذر تحديث المتجر");
      return res.json() as Promise<ProviderStore>;
    },
    onSuccess: (store) => {
      qc.setQueryData<ProviderStore[]>(queryKey, (current = []) =>
        current.map((item) => (item.id === store.id ? store : item)),
      );
      toast({ title: "تم تحديث حالة المتجر" });
    },
    onError: (error) => {
      toast({ title: error instanceof Error ? error.message : "تعذر تحديث المتجر", variant: "destructive" });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (store: ProviderStore) => {
      const res = await fetch(`/api/provider/stores/${store.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("تعذر تغيير كلمة المرور");
      return res.json() as Promise<{ merchantEmail: string; merchantPassword: string }>;
    },
    onSuccess: (data) => {
      setCreatedPassword(data.merchantPassword);
      setVisiblePassword(false);
      toast({ title: `تم توليد كلمة مرور جديدة لـ ${data.merchantEmail}` });
    },
    onError: (error) => {
      toast({ title: error instanceof Error ? error.message : "تعذر تغيير كلمة المرور", variant: "destructive" });
    },
  });

  const visibleStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((store) =>
      store.name.toLowerCase().includes(q) ||
      store.ownerName.toLowerCase().includes(q) ||
      store.slug.toLowerCase().includes(q) ||
      (store.merchantEmail ?? "").toLowerCase().includes(q),
    );
  }, [search, stores]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">المتاجر</h1>
          <p className="text-sm text-muted-foreground mt-1">إنشاء وتتبع المتاجر والتجار فقط.</p>
        </div>
        <button
          onClick={() => setShowCreate((value) => !value)}
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          متجر جديد
        </button>
      </div>

      {createdPassword && (
        <div className="mb-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 mb-2">كلمة مرور التاجر الجاهزة للتسليم</p>
          <div className="flex items-center gap-2">
            <input
              value={visiblePassword ? createdPassword : "••••••••••••"}
              readOnly
              dir="ltr"
              className="flex-1 h-9 bg-background border border-input rounded-md px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setVisiblePassword((value) => !value)}
              className="w-9 h-9 rounded-md border border-border flex items-center justify-center"
              aria-label={visiblePassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {visiblePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="bg-card border border-card-border rounded-lg p-5 mb-5">
          <div className="grid md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="اسم المتجر" value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} />
            <input className={inputCls} placeholder="اسم التاجر" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} />
            <input className={inputCls} placeholder="الهاتف" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} dir="ltr" />
            <input className={inputCls} placeholder="الولاية / المدينة" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            <input className={inputCls} placeholder="بريد التاجر" value={form.merchantEmail} onChange={(event) => setForm({ ...form, merchantEmail: event.target.value })} dir="ltr" />
            <input className={inputCls} placeholder="كلمة مرور اختيارية" value={form.merchantPassword} onChange={(event) => setForm({ ...form, merchantPassword: event.target.value })} dir="ltr" />
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => createStore.mutate()}
              disabled={createStore.isPending}
              className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {createStore.isPending ? "جاري الإنشاء..." : "إنشاء المتجر"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-lg p-4 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full h-10 bg-background border border-input rounded-md pr-9 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right"
            placeholder="ابحث عن متجر أو تاجر"
          />
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, index) => <div key={index} className="h-14 bg-muted animate-pulse rounded-md" />)}
          </div>
        ) : visibleStores.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">لا توجد متاجر مطابقة.</div>
        ) : (
          <div>
            <table className="w-full table-fixed border-collapse border border-border text-sm">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[21%]" />
                <col className="w-[24%]" />
                <col className="w-[8%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={headCell}>المتجر</th>
                  <th className={headCell}>التاجر</th>
                  <th className={headCell}>الحساب</th>
                  <th className={headCell}>طلبات</th>
                  <th className={headCell}>الحالة</th>
                  <th className={headCell}>الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleStores.map((store) => (
                  <tr key={store.id} className="hover:bg-accent/40 transition-colors">
                    <td className={bodyCell}>
                      <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">/s/{store.slug}</p>
                    </td>
                    <td className={bodyCell}>
                      <p className="text-sm font-semibold text-foreground truncate">{store.ownerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{store.city} · {store.phone}</p>
                    </td>
                    <td className={`${bodyCell} text-muted-foreground`}>
                      <div className="truncate" dir="ltr">{store.merchantEmail ?? "-"}</div>
                    </td>
                    <td className={`${bodyCell} text-sm font-semibold tabular-nums whitespace-nowrap`}>{store.ordersCount}</td>
                    <td className={bodyCell}>
                      <span className={`inline-flex h-7 px-3 rounded-full text-xs font-semibold items-center justify-center whitespace-nowrap ${store.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                        {store.isActive ? "نشط" : "متوقف"}
                      </span>
                    </td>
                    <td className={bodyCell}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStore.mutate({ store, isActive: !store.isActive })}
                          disabled={updateStore.isPending}
                          className="h-8 px-3 rounded-md border border-border text-xs font-semibold hover:bg-accent disabled:opacity-50 whitespace-nowrap"
                        >
                          {store.isActive ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => resetPassword.mutate(store)}
                          disabled={resetPassword.isPending}
                          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                        >
                          كلمة مرور
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
