import { useStoreId, useAuth } from "@/context/AuthContext";
import { useGetStore, useUpdateStore, getGetStoreQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Store, User, Lock, Save } from "lucide-react";

const TABS = [
  { id: "store", label: "المتجر", icon: Store },
  { id: "account", label: "الحساب", icon: User },
  { id: "security", label: "كلمة المرور", icon: Lock },
];

function Field({
  label, value, onChange, placeholder, dir, type,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; dir?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full h-9 bg-background border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function Settings() {
  const STORE_ID = useStoreId();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("store");

  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const { data: store, isLoading } = useGetStore(STORE_ID, {
    query: { queryKey: getGetStoreQueryKey(STORE_ID) },
  });

  const updateStore = useUpdateStore({
    mutation: {
      onSuccess: (updated) => {
        qc.invalidateQueries({ queryKey: getGetStoreQueryKey(STORE_ID) });
        toast({ title: "تم حفظ إعدادات المتجر" });
        if (updated.name) setStoreName(updated.name);
      },
      onError: () => toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" }),
    },
  });

  useEffect(() => {
    if (store) {
      setStoreName(store.name ?? "");
      setOwnerName(store.ownerName ?? "");
      setPhone(store.phone ?? "");
      setCity(store.city ?? "");
    }
  }, [store]);

  const handleSaveStore = () => {
    updateStore.mutate({
      storeId: STORE_ID,
      data: { name: storeName, ownerName, phone, city },
    });
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast({ title: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    if (newPw.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "حدث خطأ");
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : "حدث خطأ",
        variant: "destructive",
      });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-5">الإعدادات</h1>

      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "store" && (
        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">بيانات المتجر</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : (
            <>
              <Field label="اسم المتجر" value={storeName} onChange={setStoreName} placeholder="متجر الأناقة" />
              <Field label="اسم صاحب المتجر" value={ownerName} onChange={setOwnerName} placeholder="أحمد العمري" />
              <Field label="رقم الجوال" value={phone} onChange={setPhone} placeholder="05XXXXXXXX" dir="ltr" />
              <Field label="المدينة" value={city} onChange={setCity} placeholder="الجزائر" />
              <button
                disabled={updateStore.isPending}
                onClick={handleSaveStore}
                className="flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateStore.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "account" && (
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">معلومات الحساب</h2>
          <div>
            <InfoRow label="البريد الإلكتروني" value={user?.email ?? "-"} />
            <InfoRow label="المتجر المرتبط" value={user?.storeName ?? "-"} />
            <InfoRow label="رقم المتجر" value={String(STORE_ID)} />
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">تغيير كلمة المرور</h2>
          <Field label="كلمة المرور الحالية" type="password" value={currentPw} onChange={setCurrentPw} />
          <Field label="كلمة المرور الجديدة" type="password" value={newPw} onChange={setNewPw} placeholder="6 أحرف على الأقل" />
          <Field label="تأكيد كلمة المرور الجديدة" type="password" value={confirmPw} onChange={setConfirmPw} />
          <button
            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
            onClick={handleChangePassword}
            className="flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {pwLoading ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </button>
        </div>
      )}
    </div>
  );
}
