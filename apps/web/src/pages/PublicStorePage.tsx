import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, MapPin, Package, Search, Store, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface PublicStoreData {
  store: {
    id: number;
    slug: string;
    name: string;
    ownerName: string;
    phone: string;
    city: string;
    logoUrl: string | null;
  };
  categories: Array<{
    id: number;
    name: string;
    slug: string;
    isDefault: boolean;
  }>;
  products: Array<{
    id: number;
    categoryId: number | null;
    productName: string;
    price: number;
    description: string;
    slug: string;
    imageUrl: string | null;
    productImages: string[];
    availableSizes: string[];
    availableColors: string[];
    themeColor: string;
  }>;
}

function productImage(product: PublicStoreData["products"][number]) {
  return product.productImages[0] ?? product.imageUrl;
}

export default function PublicStorePage() {
  const { storeSlug } = useParams();
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<PublicStoreData>({
    queryKey: ["public-store", storeSlug],
    queryFn: async () => {
      const res = await fetch(`/api/public/s/${storeSlug}`);
      if (!res.ok) throw new Error("المتجر غير متاح");
      return res.json();
    },
  });

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.products ?? []).filter((product) => {
      const categoryMatch = activeCategory === "all" || product.categoryId === activeCategory;
      const searchMatch = !q || product.productName.toLowerCase().includes(q) || product.description.toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, data?.products, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-14 h-14 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-lg font-bold text-foreground">المتجر غير متاح</h1>
        <p className="text-sm text-muted-foreground mt-2">تحقق من رابط المتجر أو حاول لاحقا.</p>
      </div>
    );
  }

  const categoriesWithProducts = data.categories.filter((category) =>
    data.products.some((product) => product.categoryId === category.id),
  );
  const featured = data.products[0];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {data.store.logoUrl ? (
                  <img src={data.store.logoUrl} alt={data.store.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-primary-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground truncate">{data.store.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{data.store.city}</span>
                </div>
              </div>
            </div>
            <a
              href="#products"
              className="hidden sm:inline-flex h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold items-center"
            >
              تصفح المنتجات
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5 items-stretch">
            <div className="bg-card border border-card-border rounded-lg p-6 sm:p-8 flex flex-col justify-between min-h-72">
              <div>
                <p className="text-xs font-semibold text-primary mb-3">معرض منتجات منظم للطلب المباشر</p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight">
                  اختر المنتج المناسب وأرسل طلبك من صفحة مخصصة.
                </h1>
                <p className="text-sm text-muted-foreground leading-7 mt-4 max-w-xl">
                  منتجات المتجر مرتبة بتصنيفات واضحة. كل منتج يفتح صفحة طلب مستقلة لتسجيل بياناتك وتأكيد الطلب بسهولة.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-8">
                <div className="bg-muted/40 border border-card-border rounded-md p-3">
                  <p className="text-xl font-bold tabular-nums">{data.products.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">منتج</p>
                </div>
                <div className="bg-muted/40 border border-card-border rounded-md p-3">
                  <p className="text-xl font-bold tabular-nums">{categoriesWithProducts.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">تصنيف</p>
                </div>
                <div className="bg-muted/40 border border-card-border rounded-md p-3">
                  <p className="text-xl font-bold">دج</p>
                  <p className="text-xs text-muted-foreground mt-0.5">الدفع عند الاستلام</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-lg overflow-hidden min-h-72">
              {featured && productImage(featured) ? (
                <img src={productImage(featured) ?? ""} alt={featured.productName} className="w-full h-full object-cover min-h-72" />
              ) : (
                <div className="w-full h-full min-h-72 bg-muted flex items-center justify-center">
                  <Package className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="products" className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <div className="bg-card border border-card-border rounded-lg p-4 sm:p-5 mb-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">المنتجات</h2>
                <p className="text-sm text-muted-foreground mt-1">تصفح حسب التصنيف أو ابحث باسم المنتج.</p>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full h-10 bg-background border border-input rounded-md pr-9 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right"
                  placeholder="ابحث عن منتج"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pt-4">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`h-9 px-4 rounded-md border text-sm font-semibold whitespace-nowrap ${
                  activeCategory === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                }`}
              >
                الكل
              </button>
              {categoriesWithProducts.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`h-9 px-4 rounded-md border text-sm font-semibold whitespace-nowrap ${
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-16 text-center">
              <Package className="w-9 h-9 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">لا توجد منتجات مطابقة</p>
              <p className="text-xs text-muted-foreground mt-1">جرّب تصنيفا آخر أو غيّر كلمة البحث.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProducts.map((product) => {
                const image = productImage(product);
                const category = data.categories.find((item) => item.id === product.categoryId);
                return (
                  <Link
                    key={product.id}
                    href={`/s/${data.store.slug}/p/${product.slug}`}
                    className="group bg-card border border-card-border rounded-lg overflow-hidden hover:border-primary/60 transition-colors"
                  >
                    <div className="aspect-[4/3] bg-muted overflow-hidden">
                      {image ? (
                        <img src={image} alt={product.productName} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Tag className="w-3.5 h-3.5" />
                        <span>{category?.name ?? "عام"}</span>
                      </div>
                      <h3 className="font-bold text-foreground line-clamp-1">{product.productName}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2 leading-6">{product.description}</p>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                        <span className="text-lg font-bold text-primary tabular-nums">{formatCurrency(product.price)}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground group-hover:text-primary">
                          اطلب الآن
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>{data.store.name} · {data.store.city}</p>
          <p>صفحة طلبات منظمة وسريعة</p>
        </div>
      </footer>
    </div>
  );
}
