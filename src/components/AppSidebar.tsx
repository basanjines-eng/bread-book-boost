import {
  LayoutDashboard, BookOpen, FileText, ShoppingCart,
  Factory, Package, Wallet, BookMarked, BarChart3,
  CalendarCheck, Settings, Warehouse, CookingPot
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Plan de Cuentas", url: "/plan-cuentas", icon: BookOpen },
  { title: "Libro Diario", url: "/libro-diario", icon: FileText },
  { title: "Inventario de Insumos", url: "/insumos", icon: Warehouse },
  { title: "Recetas", url: "/recetas", icon: CookingPot },
  { title: "Producción", url: "/produccion", icon: Factory },
  { title: "Producto Terminado", url: "/stock", icon: Package },
  { title: "Ventas", url: "/ventas", icon: ShoppingCart },
  { title: "Flujo de Caja", url: "/flujo-caja", icon: Wallet },
  { title: "Libro Mayor", url: "/libro-mayor", icon: BookMarked },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
  { title: "Cierre Mensual", url: "/cierre-mensual", icon: CalendarCheck },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-display font-bold text-sm">P</span>
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-lg text-sidebar-foreground">PanConta</span>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
