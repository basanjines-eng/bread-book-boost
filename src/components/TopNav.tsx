import {
  LayoutDashboard, BookOpen, FileText, ShoppingCart,
  Factory, Package, Wallet, BookMarked, BarChart3,
  CalendarCheck, Settings, Warehouse, CookingPot, ChevronDown
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Plan de Cuentas", url: "/plan-cuentas", icon: BookOpen },
  { title: "Libro Diario", url: "/libro-diario", icon: FileText },
  { title: "Insumos", url: "/insumos", icon: Warehouse },
  { title: "Recetas", url: "/recetas", icon: CookingPot },
  { title: "Producción", url: "/produccion", icon: Factory },
  { title: "Stock", url: "/stock", icon: Package },
  { title: "Ventas", url: "/ventas", icon: ShoppingCart },
  { title: "Flujo de Caja", url: "/flujo-caja", icon: Wallet },
  { title: "Libro Mayor", url: "/libro-mayor", icon: BookMarked },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
  { title: "Cierre Mensual", url: "/cierre-mensual", icon: CalendarCheck },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

// Split into primary (visible) and overflow (dropdown)
const PRIMARY_COUNT = 8;
const primaryItems = items.slice(0, PRIMARY_COUNT);
const overflowItems = items.slice(PRIMARY_COUNT);

export function TopNav() {
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <header className="top-nav-header sticky top-0 z-50 w-full border-b border-nav-border shadow-sm">
      <div className="flex items-center h-14 px-4 gap-1">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-4 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-display font-bold text-lg text-nav-foreground tracking-tight">PanConta</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-nav-border mx-2 shrink-0" />

        {/* Primary nav items */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-hidden">
          {primaryItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="nav-link flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-nav-muted whitespace-nowrap transition-all duration-150 hover:bg-nav-hover hover:text-nav-foreground"
              activeClassName="nav-link-active bg-nav-active text-nav-active-text font-medium"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </NavLink>
          ))}

          {/* Overflow dropdown */}
          {overflowItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setOverflowOpen(!overflowOpen)}
                className="nav-link flex items-center gap-1 px-3 py-2 rounded-md text-sm text-nav-muted whitespace-nowrap transition-all duration-150 hover:bg-nav-hover hover:text-nav-foreground"
              >
                <span>Más</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${overflowOpen ? 'rotate-180' : ''}`} />
              </button>

              {overflowOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-nav-border bg-nav-dropdown shadow-lg z-50 py-1 overflow-hidden">
                    {overflowItems.map((item) => (
                      <NavLink
                        key={item.title}
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-nav-muted hover:bg-nav-hover hover:text-nav-foreground transition-colors"
                        activeClassName="bg-nav-active text-nav-active-text font-medium"
                        onClick={() => setOverflowOpen(false)}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
