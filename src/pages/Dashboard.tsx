import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/accounting";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const {
    cuentas, getDetallesContabilizados, getComprobantesContabilizados,
    stock, productos, ventas, getProducto,
  } = useAccounting();

  const detalles = getDetallesContabilizados();
  const comprobantes = getComprobantesContabilizados();

  // Disponible total (cuentas caja/banco)
  const cajaIds = new Set(cuentas.filter(c => c.es_caja_banco).map(c => c.id));
  const disponible = detalles
    .filter(d => cajaIds.has(d.cuenta_id))
    .reduce((s, d) => s + d.debe - d.haber, 0);

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

  const recentCompIds = new Set(
    comprobantes.filter(c => c.fecha >= thirtyStr).map(c => c.id)
  );
  const recentDetalles = detalles.filter(d => recentCompIds.has(d.comprobante_id));

  const ingresoIds = new Set(cuentas.filter(c => c.tipo === 'INGRESO').map(c => c.id));
  const gastoIds = new Set(cuentas.filter(c => c.tipo === 'GASTO').map(c => c.id));

  const ingresos30 = recentDetalles
    .filter(d => ingresoIds.has(d.cuenta_id))
    .reduce((s, d) => s + d.haber - d.debe, 0);

  const gastos30 = recentDetalles
    .filter(d => gastoIds.has(d.cuenta_id))
    .reduce((s, d) => s + d.debe - d.haber, 0);

  const resultado30 = ingresos30 - gastos30;

  // Today
  const todayStr = new Date().toISOString().split('T')[0];
  const ventasHoy = ventas.filter(v => v.fecha === todayStr);
  const ventasTotalHoy = ventasHoy.reduce((s, v) => s + v.total_venta, 0);
  const costoHoy = ventasHoy.reduce((s, v) => s + v.costo_total_venta, 0);
  const utilidadHoy = ventasTotalHoy - costoHoy;

  // Margin by product (30 days)
  const ventas30 = ventas.filter(v => v.fecha >= thirtyStr);
  const productoMargen = productos.map(p => {
    const pv = ventas30.filter(v => v.producto_id === p.id);
    const totalVentas = pv.reduce((s, v) => s + v.total_venta, 0);
    const totalCosto = pv.reduce((s, v) => s + v.costo_total_venta, 0);
    const margen = totalVentas - totalCosto;
    const margenPct = totalVentas > 0 ? (margen / totalVentas) * 100 : 0;
    return { nombre: p.nombre, ventas: totalVentas, costo: totalCosto, margen, margenPct };
  });

  // Stock bajo
  const stockBajo = stock.filter(s => s.stock_minimo > 0 && s.cantidad_actual <= s.stock_minimo);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Disponible Total" value={formatMoney(disponible)} icon={<Wallet className="h-5 w-5" />} color="primary" />
        <KpiCard title="Ingresos (30d)" value={formatMoney(ingresos30)} icon={<TrendingUp className="h-5 w-5" />} color="success" />
        <KpiCard title="Gastos (30d)" value={formatMoney(gastos30)} icon={<TrendingDown className="h-5 w-5" />} color="destructive" />
        <KpiCard title="Resultado (30d)" value={formatMoney(resultado30)} icon={<BarChart3 className="h-5 w-5" />} color={resultado30 >= 0 ? 'success' : 'destructive'} />
      </div>

      {/* Today */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ventas Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display font-bold">{formatMoney(ventasTotalHoy)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Costo Ventas Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display font-bold">{formatMoney(costoHoy)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Utilidad Bruta Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-display font-bold ${utilidadHoy >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatMoney(utilidadHoy)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Margen por producto */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Margen por Producto (30 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Producto</th>
                  <th className="text-right py-2 font-medium">Ventas</th>
                  <th className="text-right py-2 font-medium">Costo</th>
                  <th className="text-right py-2 font-medium">Margen</th>
                  <th className="text-right py-2 font-medium">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {productoMargen.map(p => (
                  <tr key={p.nombre} className="border-b border-border/50">
                    <td className="py-2">{p.nombre}</td>
                    <td className="text-right py-2">{formatMoney(p.ventas)}</td>
                    <td className="text-right py-2">{formatMoney(p.costo)}</td>
                    <td className={`text-right py-2 font-medium ${p.margen >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatMoney(p.margen)}
                    </td>
                    <td className="text-right py-2">{p.margenPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stock bajo */}
      {stockBajo.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Stock Bajo ({stockBajo.length} productos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stockBajo.map(s => {
                const prod = getProducto(s.producto_id);
                return (
                  <div key={s.id} className="flex justify-between items-center">
                    <span>{prod?.nombre}</span>
                    <Badge variant="destructive">{s.cantidad_actual} / mín. {s.stock_minimo}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary',
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className={colorClasses[color] || 'text-primary'}>{icon}</span>
        </div>
        <p className={`text-2xl font-display font-bold ${colorClasses[color] || ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
