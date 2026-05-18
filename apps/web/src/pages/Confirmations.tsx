import { useStoreId } from "@/context/AuthContext";
import {
  useListConfirmations,
  getListConfirmationsQueryKey,
  useConfirmOrder,
  useRejectOrder,
  getListOrdersQueryKey,
  getGetOrdersSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Phone, MapPin, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import ProductImageThumb from "@/components/ProductImageThumb";


function buildWhatsAppLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "213" + digits.slice(1) : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export default function Confirmations() {
  const STORE_ID = useStoreId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useListConfirmations(STORE_ID, {
    query: { queryKey: getListConfirmationsQueryKey(STORE_ID) },
  });

  const confirmOrder = useConfirmOrder({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListConfirmationsQueryKey(STORE_ID) });
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey(STORE_ID) });
        qc.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey(STORE_ID) });
        toast({ title: "تم تأكيد الطلب" });
      },
    },
  });

  const rejectOrder = useRejectOrder({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListConfirmationsQueryKey(STORE_ID) });
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey(STORE_ID) });
        qc.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey(STORE_ID) });
        toast({ title: "تم رفض الطلب", variant: "destructive" });
      },
    },
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground">التأكيدات المعلقة</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? "..." : `${orders?.length ?? 0} طلب بانتظار التأكيد`}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="text-base font-semibold text-foreground">لا توجد طلبات معلقة</p>
          <p className="text-sm text-muted-foreground mt-1">جميع الطلبات تمت معالجتها</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const variantLines = [
              order.selectedSize ? `المقاس: ${order.selectedSize}` : null,
              order.selectedColor ? `اللون: ${order.selectedColor}` : null,
            ].filter(Boolean).join("\n");
            const confirmMsg = `عزيزي/عزيزتي ${order.customerName}،\nتم استلام طلبك رقم #${order.id} بنجاح.\nالمنتج: ${order.landingPageName ?? "المنتج"}\n${variantLines ? `${variantLines}\n` : ""}الكمية: ${order.quantity} قطعة\nالمبلغ الإجمالي: ${formatCurrency(order.totalPrice)}\n\nسيتم التواصل معك قريباً لترتيب التوصيل. شكراً لثقتك بنا!`;

            return (
              <div
                key={order.id}
                data-testid={`card-confirmation-${order.id}`}
                className="bg-card border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <ProductImageThumb src={order.productImageUrl} alt={order.landingPageName} className="h-16 w-16" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {new Date(order.createdAt).toLocaleString("ar-SA-u-nu-latn")}
                      </span>
                      <span className="text-xs text-muted-foreground">· طلب #{order.id}</span>
                    </div>
                    <p className="font-semibold text-foreground mb-1">{order.customerName}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span dir="ltr">{order.customerPhone}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {order.customerCity}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-muted-foreground">{order.landingPageName ?? "منتج"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(order.totalPrice)}</span>
                      <span className="text-muted-foreground">· {order.quantity} قطعة</span>
                      {order.selectedSize && <span className="text-muted-foreground">· مقاس {order.selectedSize}</span>}
                      {order.selectedColor && <span className="text-muted-foreground">· لون {order.selectedColor}</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <a
                    href={buildWhatsAppLink(order.customerPhone, confirmMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-900/20"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    واتساب
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(confirmMsg)
                        .then(() => toast({ title: "تم نسخ رسالة التأكيد" }))
                        .catch(() => toast({ title: "تعذّر النسخ", variant: "destructive" }));
                    }}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-border text-muted-foreground bg-card hover:bg-accent transition-colors"
                  >
                    نسخ الرسالة
                  </button>
                  <div className="flex gap-2 mr-auto">
                    <button
                      data-testid={`btn-reject-${order.id}`}
                      disabled={confirmOrder.isPending || rejectOrder.isPending}
                      onClick={() => rejectOrder.mutate({ storeId: STORE_ID, orderId: order.id, data: {} })}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      رفض
                    </button>
                    <button
                      data-testid={`btn-confirm-${order.id}`}
                      disabled={confirmOrder.isPending || rejectOrder.isPending}
                      onClick={() => confirmOrder.mutate({ storeId: STORE_ID, orderId: order.id, data: {} })}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تأكيد
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
