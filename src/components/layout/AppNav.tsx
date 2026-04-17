import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/despensa", label: "📦 Productos", exact: true },
  { to: "/despensa/stock", label: "🗄️ Stock", exact: false },
  { to: "/despensa/auditoria", label: "🔍 Auditoría", exact: false },
  { to: "/despensa/exportar", label: "📤 Export", exact: false },
  { to: "/despensa/importar", label: "📥 Import", exact: false },
] as const;

export function AppNav() {
  const location = useLocation();

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? location.pathname === item.to || location.pathname === item.to + "/"
          : location.pathname.startsWith(item.to);

        return (
          <Link
            key={item.to}
            to={item.to as any}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
