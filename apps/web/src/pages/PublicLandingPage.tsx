import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Phone,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const schema = z.object({
  customerName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  customerPhone: z.string().min(9, "رقم الهاتف غير صحيح").max(15),
  customerCity: z.string().optional(),
  customerAddress: z.string().optional(),
  quantity: z.number().int().min(1).max(10),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LandingPageData {
  productName: string;
  price: number;
  description: string;
  imageUrl: string | null;
  productImages: string[];
  availableSizes: string[];
  availableColors: string[];
  deliveryZones: Array<{
    id: number;
    wilayaCode: string;
    wilayaName: string;
    homeFee: number | null;
    officeFee: number | null;
    returnFee: number;
    communes: Array<{
      id: number;
      name: string;
      dairaName: string;
    }>;
  }>;
  galleryDisplay: "carousel" | "grid";
  themeColor: string;
  deliveryInfo: string | null;
  whatsappNumber: string | null;
  storeId: number;
}

const inputCls = "w-full h-10 bg-background border border-input rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-right";
const labelCls = "text-xs font-semibold text-muted-foreground block mb-1.5";
const PANEL_ORANGE = "#f59e0b";
const LEGACY_BLUE = "#1d1a72";

function resolveThemeColor(color: string | null | undefined) {
  return !color || color === LEGACY_BLUE ? PANEL_ORANGE : color;
}

export default function PublicLandingPage() {
  const { storeSlug, productSlug, slug } = useParams();
  const productPath = storeSlug && productSlug
    ? `/api/public/s/${encodeURIComponent(storeSlug)}/p/${encodeURIComponent(productSlug)}`
    : `/api/public/p/${encodeURIComponent(slug ?? "")}`;
  const [submitted, setSubmitted] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedDeliveryZoneId, setSelectedDeliveryZoneId] = useState<number | null>(null);
  const [selectedCommuneName, setSelectedCommuneName] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"HOME" | "OFFICE">("HOME");
  const [selectionError, setSelectionError] = useState("");
  const orderFormRef = useRef<HTMLFormElement>(null);

  const { data: page, isLoading, error } = useQuery<LandingPageData>({
    queryKey: ["public-page", storeSlug ?? "legacy", productSlug ?? slug],
    queryFn: async () => {
      const res = await fetch(productPath);
      if (!res.ok) throw new Error("الصفحة غير موجودة");
      return res.json();
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerCity: "",
      customerAddress: "",
      quantity: 1,
      notes: "",
    },
  });

  const submitOrder = useMutation({
    mutationFn: async (values: FormValues & {
      selectedSize?: string;
      selectedColor?: string;
      deliveryZoneId: number;
      deliveryCommuneName: string;
      deliveryMethod: "HOME" | "OFFICE";
    }) => {
      const res = await fetch(`${productPath}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "فشل إرسال الطلب");
      }
      return res.json();
    },
    onSuccess: (order: { id?: number }) => {
      setSubmittedOrderId(order.id ?? null);
      setSubmitted(true);
    },
  });

  useEffect(() => {
    if (!page?.deliveryZones.length || selectedDeliveryZoneId) return;
    const firstZone = page.deliveryZones[0];
    setSelectedDeliveryZoneId(firstZone.id);
    setSelectedCommuneName(firstZone.communes[0]?.name ?? "");
    setDeliveryMethod(firstZone.homeFee !== null ? "HOME" : "OFFICE");
  }, [page?.deliveryZones, selectedDeliveryZoneId]);

  const onSubmit = (values: FormValues) => {
    if (page?.availableSizes.length && !selectedSize) {
      setSelectionError("اختر المقاس قبل إرسال الطلب");
      return;
    }
    if (page?.availableColors.length && !selectedColor) {
      setSelectionError("اختر اللون قبل إرسال الطلب");
      return;
    }
    const zone = page?.deliveryZones.find((item) => item.id === selectedDeliveryZoneId);
    if (!zone) {
      setSelectionError("اختر ولاية التوصيل قبل إرسال الطلب");
      return;
    }
    if (!selectedCommuneName || !zone.communes.some((commune) => commune.name === selectedCommuneName)) {
      setSelectionError("اختر البلدية من القائمة قبل إرسال الطلب");
      return;
    }
    if (zone.officeFee === null || (deliveryMethod === "HOME" && zone.homeFee === null)) {
      setSelectionError("طريقة التوصيل غير متاحة لهذه الولاية");
      return;
    }
    setSelectionError("");
    submitOrder.mutate({
      ...values,
      customerCity: zone.wilayaName,
      deliveryZoneId: zone.id,
      deliveryCommuneName: selectedCommuneName,
      deliveryMethod,
      quantity,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-14 h-14 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-lg font-bold text-foreground">الصفحة غير موجودة</h1>
        <p className="text-muted-foreground mt-2 text-sm">هذا المنتج غير متاح حاليا</p>
      </div>
    );
  }

  const themeColor = resolveThemeColor(page.themeColor);
  const images = page.productImages?.length ? page.productImages : page.imageUrl ? [page.imageUrl] : [];
  const shownImage = images[activeImage] ?? images[0];
  const selectedDeliveryZone = page.deliveryZones.find((item) => item.id === selectedDeliveryZoneId) ?? null;
  const selectedCommune = selectedDeliveryZone?.communes.find((commune) => commune.name === selectedCommuneName) ?? null;
  const availableDeliveryMethods = selectedDeliveryZone
    ? [
        {
          value: "HOME" as const,
          label: "توصيل للمنزل",
          fee: selectedDeliveryZone.officeFee !== null && selectedDeliveryZone.homeFee !== null
            ? selectedDeliveryZone.officeFee + selectedDeliveryZone.homeFee
            : null,
        },
        { value: "OFFICE" as const, label: "استلام من المكتب", fee: selectedDeliveryZone.officeFee },
      ].filter((item) => item.fee !== null)
    : [];
  const deliveryFee = selectedDeliveryZone
    ? Number(
        deliveryMethod === "HOME"
          ? (selectedDeliveryZone.officeFee ?? 0) + (selectedDeliveryZone.homeFee ?? 0)
          : selectedDeliveryZone.officeFee ?? 0,
      )
    : 0;
  const productTotal = page.price * quantity;
  const totalPrice = formatCurrency(productTotal);
  const payableTotal = formatCurrency(productTotal + deliveryFee);

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-20 h-20 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">تم استلام طلبك</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          سنتواصل معك قريبا لتأكيد الطلب وترتيب التوصيل.
        </p>
        {submittedOrderId && (
          <p className="mt-4 text-sm font-semibold text-foreground tabular-nums">
            رقم الطلب #{submittedOrderId}
          </p>
        )}
        {page.whatsappNumber && (
          <a
            href={`https://wa.me/${page.whatsappNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center gap-2 px-5 h-10 text-white rounded-md text-sm font-semibold shadow-sm"
            style={{ backgroundColor: "#25D366" }}
          >
            <Phone className="w-4 h-4" />
            تواصل عبر واتساب
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <section className="bg-card border border-card-border rounded-lg overflow-hidden">
            {shownImage ? (
              <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
                <img src={shownImage} alt={page.productName} className="w-full h-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImage((index) => (index + 1) % images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md bg-card/90 border border-card-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
                      aria-label="الصورة التالية"
                    >
                      <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImage((index) => (index - 1 + images.length) % images.length)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md bg-card/90 border border-card-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
                      aria-label="الصورة السابقة"
                    >
                      <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground text-sm">
                لا توجد صورة
              </div>
            )}

            {images.length > 1 && page.galleryDisplay === "grid" ? (
              <div className="grid grid-cols-5 gap-2 px-4 py-3 border-t border-card-border">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`aspect-square rounded-md overflow-hidden border-2 ${index === activeImage ? "border-primary" : "border-card-border"}`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : images.length > 1 ? (
              <div className="flex justify-center gap-2 py-3 border-t border-card-border">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: index === activeImage ? themeColor : "hsl(var(--border))" }}
                    aria-label={`صورة ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}

            <div className="px-5 pt-4 pb-5">
              <h1 className="text-2xl font-bold text-foreground leading-tight">{page.productName}</h1>
              <p className="text-2xl font-bold mt-4 text-left tabular-nums" style={{ color: themeColor }}>
                {formatCurrency(page.price)}
              </p>
              <p className="text-muted-foreground mt-3 text-sm leading-7">{page.description}</p>

              {page.availableSizes.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-foreground mb-2">المقاس</p>
                  <div className="flex flex-wrap gap-2">
                    {page.availableSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className="min-w-12 h-9 px-3 rounded-md border text-sm font-semibold transition-colors"
                        style={{
                          borderColor: selectedSize === size ? themeColor : "hsl(var(--border))",
                          backgroundColor: selectedSize === size ? themeColor : "hsl(var(--background))",
                          color: selectedSize === size ? "#ffffff" : "hsl(var(--foreground))",
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {page.availableColors.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-foreground mb-2">اللون</p>
                  <div className="flex flex-wrap gap-2">
                    {page.availableColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className="h-9 px-3 rounded-md border text-sm font-semibold transition-colors"
                        style={{
                          borderColor: selectedColor === color ? themeColor : "hsl(var(--border))",
                          backgroundColor: selectedColor === color ? themeColor : "hsl(var(--background))",
                          color: selectedColor === color ? "#ffffff" : "hsl(var(--foreground))",
                        }}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {page.deliveryInfo && (
                <div className="flex items-center gap-2 mt-5 rounded-md px-4 py-3 border border-card-border bg-muted/40">
                  <Truck className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                  <p className="text-sm text-foreground">{page.deliveryInfo}</p>
                </div>
              )}
            </div>
          </section>

          <form ref={orderFormRef} onSubmit={form.handleSubmit(onSubmit)} className="bg-card border border-card-border rounded-lg p-4 sm:p-5 space-y-3 lg:sticky lg:top-6">
            <div className="pb-3 border-b border-card-border">
              <p className="text-base font-bold text-foreground">للطلب املأ المعلومات</p>
              <p className="text-xs text-muted-foreground mt-0.5">سيتم التواصل معك لتأكيد الطلب</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div>
                <label className={labelCls}>الاسم الكامل *</label>
                <input {...form.register("customerName")} className={inputCls} placeholder="الاسم الكامل" autoComplete="name" />
                {form.formState.errors.customerName && <p className="text-xs text-destructive mt-1">{form.formState.errors.customerName.message}</p>}
              </div>
              <div>
                <label className={labelCls}>رقم الهاتف *</label>
                <input {...form.register("customerPhone")} className={inputCls} placeholder="05XXXXXXXX" type="tel" dir="ltr" autoComplete="tel" />
                {form.formState.errors.customerPhone && <p className="text-xs text-destructive mt-1">{form.formState.errors.customerPhone.message}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div>
                <label className={labelCls}>الولاية *</label>
                <select
                  value={selectedDeliveryZoneId ?? ""}
                  onChange={(event) => {
                    const zoneId = Number(event.target.value);
                    const zone = page.deliveryZones.find((item) => item.id === zoneId);
                    setSelectedDeliveryZoneId(zoneId || null);
                    if (zone) {
                      setSelectedCommuneName(zone.communes[0]?.name ?? "");
                      setDeliveryMethod(zone.homeFee !== null ? "HOME" : "OFFICE");
                    } else {
                      setSelectedCommuneName("");
                    }
                  }}
                  className={inputCls}
                  disabled={!page.deliveryZones.length}
                >
                  <option value="">اختر الولاية</option>
                  {page.deliveryZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.wilayaCode} - {zone.wilayaName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>البلدية / العنوان</label>
                <select
                  value={selectedCommuneName}
                  onChange={(event) => setSelectedCommuneName(event.target.value)}
                  className={inputCls}
                  disabled={!selectedDeliveryZone}
                >
                  <option value="">اختر البلدية</option>
                  {selectedDeliveryZone?.communes.map((commune) => (
                    <option key={commune.id} value={commune.name}>
                      {commune.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>العنوان التفصيلي</label>
              <input
                {...form.register("customerAddress")}
                className={inputCls}
                placeholder={selectedCommune ? `حي / شارع داخل ${selectedCommune.name}` : "حي / شارع"}
              />
            </div>

            <div>
              <label className={labelCls}>طريقة التوصيل *</label>
              <div className="grid grid-cols-2 gap-2">
                {availableDeliveryMethods.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setDeliveryMethod(method.value)}
                    className="h-10 rounded-md border text-xs font-semibold transition-colors"
                    style={{
                      borderColor: deliveryMethod === method.value ? themeColor : "hsl(var(--border))",
                      backgroundColor: deliveryMethod === method.value ? themeColor : "hsl(var(--background))",
                      color: deliveryMethod === method.value ? "#ffffff" : "hsl(var(--foreground))",
                    }}
                  >
                    {method.label} · {formatCurrency(Number(method.fee))}
                  </button>
                ))}
                {!availableDeliveryMethods.length && (
                  <div className="col-span-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                    لم يتم تفعيل التوصيل لهذه الصفحة بعد.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 bg-muted/40 border border-card-border rounded-md p-3">
              <div>
                <p className="text-xs text-muted-foreground font-semibold">سعر المنتج</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: themeColor }}>{totalPrice}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  التوصيل: <span className="font-semibold tabular-nums">{formatCurrency(deliveryFee)}</span>
                </p>
                <p className="text-sm font-bold text-foreground tabular-nums mt-1">
                  الإجمالي: {payableTotal}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(10, value + 1))}
                  className="w-9 h-9 rounded-md text-white text-xl font-bold flex items-center justify-center"
                  style={{ backgroundColor: themeColor }}
                >
                  +
                </button>
                <span className="text-lg font-bold text-foreground tabular-nums w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="w-9 h-9 rounded-md bg-secondary text-secondary-foreground border border-secondary-border text-xl font-bold flex items-center justify-center"
                >
                  -
                </button>
              </div>
            </div>

            <textarea
              {...form.register("notes")}
              rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-right resize-none"
              placeholder="ملاحظات اختيارية"
            />

            {selectionError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {selectionError}
              </div>
            )}

            {submitOrder.isError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {submitOrder.error instanceof Error ? submitOrder.error.message : "فشل إرسال الطلب"}
              </div>
            )}

            <button
              type="submit"
              data-testid="btn-submit-order"
              disabled={submitOrder.isPending || !availableDeliveryMethods.length}
              className="w-full h-11 rounded-md text-white text-sm font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm"
              style={{ backgroundColor: themeColor }}
            >
              {submitOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
              {submitOrder.isPending ? "جاري الإرسال..." : "أطلب الآن"}
            </button>
          </form>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-card-border px-4 py-3 lg:hidden">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {page.whatsappNumber && (
            <a
              href={`https://wa.me/${page.whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-md text-white flex items-center justify-center shadow-sm"
              style={{ backgroundColor: themeColor }}
              aria-label="واتساب"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => orderFormRef.current?.requestSubmit()}
            disabled={!availableDeliveryMethods.length}
            className="flex-1 h-11 rounded-md text-white text-sm font-bold shadow-sm"
            style={{ backgroundColor: themeColor }}
          >
            أطلب الآن
          </button>
        </div>
      </div>
    </div>
  );
}
