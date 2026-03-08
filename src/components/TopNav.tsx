import {
  LayoutDashboard, BookOpen, FileText, ShoppingCart,
  Factory, Package, Wallet, BookMarked, BarChart3,
  CalendarCheck, Settings, Warehouse, CookingPot, ChevronDown,
  FileBarChart, Scale
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

const directItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Insumos", url: "/insumos", icon: Warehouse },
  { title: "Recetas", url: "/recetas", icon: CookingPot },
  { title: "Producción", url: "/produccion", icon: Factory },
  { title: "Stock", url: "/stock", icon: Package },
  { title: "Ventas", url: "/ventas", icon: ShoppingCart },
];

const contabilidadItems = [
  { title: "Plan de Cuentas", url: "/plan-cuentas", icon: BookOpen },
  { title: "Libro Diario", url: "/libro-diario", icon: FileText },
  { title: "Flujo de Caja", url: "/flujo-caja", icon: Wallet },
  { title: "Libro Mayor", url: "/libro-mayor", icon: BookMarked },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
  { title: "Cierre Mensual", url: "/cierre-mensual", icon: CalendarCheck },
];

const contabilidadPaths = contabilidadItems.map(i => i.url);

export function TopNav() {
  const { pathname } = useLocation();
  const isContabilidadActive = contabilidadPaths.includes(pathname);

  return (
    <header className="top-nav-header sticky top-0 z-50 w-full border-b border-nav-border shadow-sm">
      <div className="max-w-[1400px] mx-auto w-full flex items-center h-14 px-3 gap-1">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand-accent flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xs">P</span>
          </div>
          <span className="font-display font-bold text-base text-nav-foreground tracking-tight">PanConta</span>
        </div>

        <div className="w-px h-5 bg-nav-border mx-1.5 shrink-0" />

        <nav className="flex items-center gap-0 flex-1 overflow-x-auto scrollbar-none">
          {directItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="nav-link inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-nav-muted whitespace-nowrap transition-all duration-200 hover:bg-nav-hover hover:text-nav-foreground hover:scale-105 shrink-0"
              activeClassName="nav-link-active bg-nav-active text-nav-active-text font-semibold"
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.title}</span>
            </NavLink>
          ))}

          {/* Contabilidad dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`nav-link inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs whitespace-nowrap transition-all duration-200 hover:bg-nav-hover hover:text-nav-foreground hover:scale-105 shrink-0 ${
                  isContabilidadActive
                    ? "nav-link-active bg-nav-active text-nav-active-text font-semibold"
                    : "text-nav-muted"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>Contabilidad</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6}>
              {contabilidadItems.map((item) => (
                <DropdownMenuItem key={item.title} asChild>
                  <Link
                    to={item.url}
                    className={`flex items-center gap-2 text-xs ${
                      pathname === item.url ? "font-semibold" : ""
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <NavLink
            to="/configuracion"
            className="nav-link inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-nav-muted whitespace-nowrap transition-all duration-200 hover:bg-nav-hover hover:text-nav-foreground hover:scale-105 shrink-0"
            activeClassName="nav-link-active bg-nav-active text-nav-active-text font-semibold"
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            <span>Configuración</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
