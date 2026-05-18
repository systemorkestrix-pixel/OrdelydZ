import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ShoppingBag,
  CheckCircle2,
  FileText,
  Users,
  BarChart3,
  Truck,
  Store,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const nav = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/orders", label: "الطلبات", icon: ShoppingBag },
  { href: "/confirmations", label: "التأكيدات", icon: CheckCircle2 },
  { href: "/landing-pages", label: "صفحات المنتجات", icon: FileText },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
  { href: "/delivery", label: "نظام التوصيل", icon: Truck },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col border-l border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground leading-tight truncate">
              {user?.storeName ?? "نظام الطلبات"}
            </p>
            <p className="text-xs text-sidebar-foreground/50 leading-tight">Conversational OS</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${href.replace("/", "") || "dashboard"}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <Link
            href="/settings"
            data-testid="nav-settings"
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 mb-1",
              location.startsWith("/settings")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            الإعدادات
          </Link>
          <div className="px-2 mb-3 mt-2">
            <p className="text-xs font-medium text-sidebar-foreground/70 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
