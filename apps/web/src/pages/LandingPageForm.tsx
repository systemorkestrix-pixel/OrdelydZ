import { useStoreId } from "@/context/AuthContext";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetLandingPage,
  getGetLandingPageQueryKey,
  useCreateLandingPage,
  useUpdateLandingPage,
  getListLandingPagesQueryKey,
  useUploadProductImage,
  useListProductCategories,
  getListProductCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  productName: z.string().min(1, "اسم المنتج مطلوب"),
  price: z.number({ invalid_type_error: "السعر مطلوب" }).positive("السعر يجب أن يكون موجبًا"),
  description: z.string().min(1, "وصف المنتج مطلوب"),
  imageUrl: z.string().optional(),
  template: z.enum(["classic", "bold", "minimal"]),
  slug: z.string().min(1, "رابط الصفحة مطلوب").regex(/^[a-z0-9-]+$/, "الرابط يقبل أحرفًا إنجليزية وأرقامًا وشرطات فقط"),
  deliveryInfo: z.string().optional(),
  whatsappNumber: z.string().optional(),
  categoryId: z.number().optional(),
});

type FormValues = z.infer<typeof schema>;
type GalleryDisplay = "carousel" | "grid";
type UploadContentType = "image/jpeg" | "image/png" | "image/webp";

const PANEL_ORANGE = "#f59e0b";
const LEGACY_BLUE = "#1d1a72";

const THEME_OPTIONS = [
  { label: "برتقالي اللوحة", value: PANEL_ORANGE },
  { label: "أسود", value: "#111827" },
  { label: "أخضر", value: "#166534" },
  { label: "بنفسجي", value: "#4338ca" },
];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function splitOptions(value: string): string[] {
  return value
    .split(/[,،\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function joinOptions(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
}

function readApiError(error: unknown): { status?: number; message?: string } {
  const candidate = error as {
    status?: number;
    message?: string;
    data?: { error?: string; message?: string };
    response?: { status?: number; data?: { error?: string; message?: string } };
  };

  return {
    status: candidate.status ?? candidate.response?.status,
    message: candidate.data?.error ?? candidate.data?.message ?? candidate.response?.data?.error ?? candidate.response?.data?.message ?? candidate.message,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const inputCls = "w-full h-9 bg-background border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right";
const textareaCls = "w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right resize-none";

export default function LandingPageForm() {
  const STORE_ID = useStoreId();
  const { pageId } = useParams();
  const [, setLocation] = useLocation();
  const isEditing = !!pageId;
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [availableSizesText, setAvailableSizesText] = useState("");
  const [availableColorsText, setAvailableColorsText] = useState("");
  const [galleryDisplay, setGalleryDisplay] = useState<GalleryDisplay>("carousel");
  const [themeColor, setThemeColor] = useState(THEME_OPTIONS[0].value);

  const { data: existing } = useGetLandingPage(STORE_ID, Number(pageId), {
    query: { enabled: isEditing, queryKey: getGetLandingPageQueryKey(STORE_ID, Number(pageId)) },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      productName: "",
      price: 0,
      description: "",
      imageUrl: "",
      template: "classic",
      slug: "",
      deliveryInfo: "",
      whatsappNumber: "",
      categoryId: undefined,
    },
  });

  const { data: categories } = useListProductCategories(STORE_ID, {
    query: { queryKey: getListProductCategoriesQueryKey(STORE_ID) },
  });

  useEffect(() => {
    if (existing) {
      const images = existing.productImages?.length ? existing.productImages : existing.imageUrl ? [existing.imageUrl] : [];
      form.reset({
        productName: existing.productName,
        price: existing.price,
        description: existing.description,
        imageUrl: existing.imageUrl ?? "",
        template: existing.template as "classic" | "bold" | "minimal",
        slug: existing.slug,
        deliveryInfo: existing.deliveryInfo ?? "",
        whatsappNumber: existing.whatsappNumber ?? "",
        categoryId: existing.categoryId ?? undefined,
      });
      setProductImages(images);
      setAvailableSizesText(joinOptions(existing.availableSizes));
      setAvailableColorsText(joinOptions(existing.availableColors));
      setGalleryDisplay((existing.galleryDisplay as GalleryDisplay | undefined) ?? "carousel");
      setThemeColor(existing.themeColor === LEGACY_BLUE ? PANEL_ORANGE : existing.themeColor || THEME_OPTIONS[0].value);
    }
  }, [existing, form]);

  const uploadImage = useUploadProductImage({
    mutation: {
      onError: () => {
        toast({ title: "تعذر رفع الصورة", variant: "destructive" });
      },
    },
  });

  const handleSaveError = (error: unknown) => {
    const apiError = readApiError(error);
    const duplicateSlugMessage = "رابط الصفحة مستخدم لمنتج آخر داخل هذا المتجر. اختر رابطًا مختلفًا.";
    const message = apiError.status === 409 ? duplicateSlugMessage : apiError.message ?? "تعذر حفظ صفحة المنتج";

    if (apiError.status === 409) {
      form.setError("slug", { type: "server", message: duplicateSlugMessage });
      form.setFocus("slug");
    }

    toast({ title: message, variant: "destructive" });
  };

  const createPage = useCreateLandingPage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLandingPagesQueryKey(STORE_ID) });
        toast({ title: "تم إنشاء الصفحة" });
        setLocation("/landing-pages");
      },
      onError: handleSaveError,
    },
  });

  const updatePage = useUpdateLandingPage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLandingPagesQueryKey(STORE_ID) });
        qc.invalidateQueries({ queryKey: getGetLandingPageQueryKey(STORE_ID, Number(pageId)) });
        toast({ title: "تم تحديث الصفحة" });
        setLocation("/landing-pages");
      },
      onError: handleSaveError,
    },
  });

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 8 - productImages.length);
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length < files.length) {
      toast({ title: "الحد الأقصى 8 صور للمنتج", variant: "destructive" });
    }

    for (const file of selected) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast({ title: "الصيغ المسموحة: JPG و PNG و WEBP", variant: "destructive" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "حجم الصورة يجب ألا يتجاوز 5MB", variant: "destructive" });
        continue;
      }
      const data = await readFileAsDataUrl(file);
      const uploaded = await uploadImage.mutateAsync({
        storeId: STORE_ID,
        data: { fileName: file.name, contentType: file.type as UploadContentType, data },
      });
      setProductImages((current) => [...current, uploaded.url]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setProductImages((current) => current.filter((item) => item !== url));
  };

  const onSubmit = (values: FormValues) => {
    const firstImage = productImages[0] ?? values.imageUrl ?? undefined;
    const data = {
      ...values,
      imageUrl: firstImage || undefined,
      productImages,
      availableSizes: splitOptions(availableSizesText),
      availableColors: splitOptions(availableColorsText),
      galleryDisplay,
      themeColor,
      deliveryInfo: values.deliveryInfo || undefined,
      whatsappNumber: values.whatsappNumber || undefined,
      categoryId: values.categoryId || undefined,
    };

    if (isEditing) {
      updatePage.mutate({ storeId: STORE_ID, pageId: Number(pageId), data });
    } else {
      createPage.mutate({ storeId: STORE_ID, data });
    }
  };

  const isPending = createPage.isPending || updatePage.isPending || uploadImage.isPending;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
        <Link href="/landing-pages" className="hover:text-foreground transition-colors">صفحات المنتجات</Link>
        <ChevronRight className="w-3.5 h-3.5 rotate-180" />
        <span className="text-foreground font-medium">{isEditing ? "تعديل الصفحة" : "صفحة جديدة"}</span>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card border border-card-border rounded-lg p-5 space-y-4">
        <Field label="اسم المنتج" error={form.formState.errors.productName?.message}>
          <input data-testid="input-product-name" {...form.register("productName")} className={inputCls} />
        </Field>

        <Field label="السعر (دج)" error={form.formState.errors.price?.message}>
          <input data-testid="input-price" type="number" step="0.01" {...form.register("price", { valueAsNumber: true })} className={inputCls} />
        </Field>

        <Field label="وصف المنتج" error={form.formState.errors.description?.message}>
          <textarea data-testid="input-description" {...form.register("description")} rows={3} className={textareaCls} />
        </Field>

        <Field label="التصنيف" error={form.formState.errors.categoryId?.message}>
          <select data-testid="select-category" {...form.register("categoryId", { valueAsNumber: true })} className={inputCls}>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="صور المنتج" error={form.formState.errors.imageUrl?.message}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {productImages.map((url) => (
              <div key={url} className="relative aspect-square rounded-md overflow-hidden border border-card-border bg-muted">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-background/90 border border-border text-destructive flex items-center justify-center"
                  aria-label="حذف الصورة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {productImages.length < 8 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadImage.isPending}
                className="aspect-square rounded-md border border-dashed border-input bg-background hover:bg-accent transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground disabled:opacity-50"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs font-medium">{uploadImage.isPending ? "رفع..." : "إضافة صورة"}</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => void handleImageFiles(event.target.files)} />
          <input type="hidden" {...form.register("imageUrl")} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المقاسات المتاحة">
            <input value={availableSizesText} onChange={(event) => setAvailableSizesText(event.target.value)} className={inputCls} placeholder="40, 41, 42, 43" />
          </Field>
          <Field label="الألوان المتاحة">
            <input value={availableColorsText} onChange={(event) => setAvailableColorsText(event.target.value)} className={inputCls} placeholder="أسود, أبيض, أزرق" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="طريقة عرض الصور">
            <select value={galleryDisplay} onChange={(event) => setGalleryDisplay(event.target.value as GalleryDisplay)} className={inputCls}>
              <option value="carousel">سلايدر</option>
              <option value="grid">شبكة</option>
            </select>
          </Field>
          <Field label="لون صفحة الطلب">
            <select value={themeColor} onChange={(event) => setThemeColor(event.target.value)} className={inputCls}>
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="القالب" error={form.formState.errors.template?.message}>
          <select data-testid="select-template" {...form.register("template")} className={inputCls}>
            <option value="classic">كلاسيك</option>
            <option value="bold">جريء</option>
            <option value="minimal">بسيط</option>
          </select>
        </Field>

        <Field label="رابط الصفحة (slug)" error={form.formState.errors.slug?.message}>
          <input data-testid="input-slug" {...form.register("slug")} className={inputCls} dir="ltr" placeholder="my-product-name" />
        </Field>

        <Field label="معلومات التوصيل" error={form.formState.errors.deliveryInfo?.message}>
          <input data-testid="input-delivery-info" {...form.register("deliveryInfo")} className={inputCls} />
        </Field>

        <Field label="رقم واتساب" error={form.formState.errors.whatsappNumber?.message}>
          <input data-testid="input-whatsapp" {...form.register("whatsappNumber")} className={inputCls} dir="ltr" />
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            data-testid="btn-submit"
            disabled={isPending}
            className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إنشاء الصفحة"}
          </button>
          <Link href="/landing-pages" className="h-9 px-4 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors inline-flex items-center">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
