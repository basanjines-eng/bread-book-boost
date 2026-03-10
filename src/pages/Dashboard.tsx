import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/accounting";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet, BarChart3, Package, ShoppingCart, PieChartIcon } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

type PeriodType = "today" | "7days" | "30days" | "thisMonth";

const CHART_COLORS = [
  "hsl(142, 40%, 42%)",   // success green
  "hsl(4, 65%, 52%)",     // destructive red
  "hsl(0, 0%, 75%)",      // primary gray
  "hsl(60, 1%, 81%)",     // secondary
  "hsl(35, 80%, 50%)",    // warning
  "hsl(200, 60%, 50%)",   // blue
  "hsl(280, 60%, 50%)",   // purple
  "hsl(160, 50%, 45%)",   // teal
];

export default function Dashboard() {
  const {
    cuentas, getDetallesContabilizados, getComprobantesContabilizados,
    stock, productos, ventas, getProducto, producciones,
  } = useAccounting();

  const [period, setPeriod] = useState<PeriodType>("30days");

  const detalles = getDetallesContabilizados();
  const comprobantes = getComprobantesContabilizados();

  // ─────────────────────────────────────────────────────────────
  // Period calculations
  // ─────────────────────────────────────────────────────────────
  const { startDate, endDate, dateRange } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let start: Date;
    const end = now;

    switch (period) {
      case "today":
        start = now;
        break;
      case "7days":
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        break;
      case "30days":
        start = new Date(now);
        start.setDate(start.getDate() - 29);
        break;
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 29);
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Generate all dates in range
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return { startDate: startStr, endDate: endStr, dateRange: dates };
  }, [period]);

  // ─────────────────────────────────────────────────────────────
  // EXISTING KPIs (unchanged logic)
  // ─────────────────────────────────────────────────────────────
  // Disponible total (cuentas caja/banco)
  const cajaIds = new Set(cuentas.filter(c => c.es_caja_banco).map(c => c.id));
  const disponible = detalles
    .filter(d => cajaIds.has(d.cuenta_id))
    .reduce((s, d) => s + d.debe - d.haber, 0);

  // Last 30 days (for existing KPIs)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

  const recentCompIds = new Set(
    comprobantes.filter(c => c.fecha >= thirtyStr).map(c => c.id)
  );
  const recentDetalles = detalles.filter(d => recentCompIds.has(d.comprobante_id));

  const ingresoIds = useMemo(() => new Set(cuentas.filter(c => c.tipo === 'INGRESO').map(c => c.id)), [cuentas]);
  const gastoIds = useMemo(() => new Set(cuentas.filter(c => c.tipo === 'GASTO').map(c => c.id)), [cuentas]);

  const ingresos30 = recentDetalles
    .filter(d => ingresoIds.has(d.cuenta_id))
    .reduce((s, d) => s + d.haber - d.debe, 0);

  const gastos30 = recentDetalles
    .filter(d => gastoIds.has(d.cuenta_id))
    .reduce((s, d) => s + d.debe - d.haber, 0);

  const resultado30 = ingresos30 - gastos30;

  // Today (existing)
  const todayStr = new Date().toISOString().split('T')[0];
  const ventasHoy = ventas.filter(v => v.fecha === todayStr && v.estado === 'ACTIVA');
  const ventasTotalHoy = ventasHoy.reduce((s, v) => s + v.total_venta, 0);
  const costoHoy = ventasHoy.reduce((s, v) => s + v.costo_total_venta, 0);
  const utilidadHoy = ventasTotalHoy - costoHoy;

  // Margin by product (30 days - existing)
  const ventas30 = ventas.filter(v => v.fecha >= thirtyStr && v.estado === 'ACTIVA');
  const productoMargen = productos.map(p => {
    const pv = ventas30.filter(v => v.producto_id === p.id);
    const totalVentas = pv.reduce((s, v) => s + v.total_venta, 0);
    const totalCosto = pv.reduce((s, v) => s + v.costo_total_venta, 0);
    const margen = totalVentas - totalCosto;
    const margenPct = totalVentas > 0 ? (margen / totalVentas) * 100 : 0;
    return { nombre: p.nombre, ventas: totalVentas, costo: totalCosto, margen, margenPct };
  });

  // Stock bajo (existing)
  const stockBajo = stock.filter(s => s.stock_minimo > 0 && s.cantidad_actual <= s.stock_minimo);

  // ─────────────────────────────────────────────────────────────
  // NEW: Period-filtered data for charts
  // ─────────────────────────────────────────────────────────────
  const ventasPeriodo = ventas.filter(v => v.fecha >= startDate && v.fecha <= endDate && v.estado === 'ACTIVA');
  const produccionesPeriodo = producciones.filter(p => p.fecha >= startDate && p.fecha <= endDate && p.estado === 'CONFIRMADA');

  const compPeriodoIds = new Set(
    comprobantes.filter(c => c.fecha >= startDate && c.fecha <= endDate).map(c => c.id)
  );
  const detallesPeriodo = detalles.filter(d => compPeriodoIds.has(d.comprobante_id));

  // ─────────────────────────────────────────────────────────────
  // 1. Line Chart: Ingresos vs Gastos por día
  // ─────────────────────────────────────────────────────────────
  const lineChartData = useMemo(() => {
    return dateRange.map(date => {
      const dayVentas = ventasPeriodo.filter(v => v.fecha === date);
      const ingresos = dayVentas.reduce((s, v) => s + v.total_venta, 0);

      const dayCompIds = new Set(comprobantes.filter(c => c.fecha === date).map(c => c.id));
      const dayDetalles = detalles.filter(d => dayCompIds.has(d.comprobante_id));
      const gastos = dayDetalles
        .filter(d => gastoIds.has(d.cuenta_id))
        .reduce((s, d) => s + d.debe - d.haber, 0);

      return {
        fecha: date.slice(5), // MM-DD
        Ingresos: ingresos,
        Gastos: gastos,
        Utilidad: ingresos - gastos,
      };
    });
  }, [dateRange, ventasPeriodo, comprobantes, detalles, gastoIds]);

  // ─────────────────────────────────────────────────────────────
  // 2a. Pie Chart: Ventas por Producto
  // ─────────────────────────────────────────────────────────────
  const ventasPorProducto = useMemo(() => {
    const totales: Record<string, number> = {};
    ventasPeriodo.forEach(v => {
      const prod = getProducto(v.producto_id);
      const nombre = prod?.nombre || 'Desconocido';
      totales[nombre] = (totales[nombre] || 0) + v.total_venta;
    });
    const total = Object.values(totales).reduce((s, v) => s + v, 0);
    return Object.entries(totales).map(([nombre, value]) => ({
      nombre,
      value,
      percent: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
    }));
  }, [ventasPeriodo, getProducto]);

  // ─────────────────────────────────────────────────────────────
  // 2b. Bar Chart: Costo vs Margen por Producto
  // ─────────────────────────────────────────────────────────────
  const costoMargenData = useMemo(() => {
    return productos.map(p => {
      const pv = ventasPeriodo.filter(v => v.producto_id === p.id);
      const totalVentas = pv.reduce((s, v) => s + v.total_venta, 0);
      const totalCosto = pv.reduce((s, v) => s + v.costo_total_venta, 0);
      const margen = totalVentas - totalCosto;
      const margenPct = totalVentas > 0 ? ((margen / totalVentas) * 100).toFixed(1) : '0';
      return { nombre: p.nombre.slice(0, 12), Costo: totalCosto, Margen: margen, margenPct };
    }).filter(p => p.Costo > 0 || p.Margen > 0);
  }, [productos, ventasPeriodo]);

  // ─────────────────────────────────────────────────────────────
  // 3a. Bar Chart: Producción del período
  // ─────────────────────────────────────────────────────────────
  const produccionData = useMemo(() => {
    const totales: Record<string, { unidades: number; costo: number; lotes: number }> = {};
    produccionesPeriodo.forEach(p => {
      const prod = getProducto(p.producto_id);
      const nombre = prod?.nombre || 'Desconocido';
      if (!totales[nombre]) totales[nombre] = { unidades: 0, costo: 0, lotes: 0 };
      totales[nombre].unidades += p.cantidad_producida;
      totales[nombre].costo += p.costo_total_produccion;
      totales[nombre].lotes += p.cantidad_lotes;
    });
    return Object.entries(totales).map(([nombre, data]) => ({
      nombre: nombre.slice(0, 12),
      Unidades: data.unidades,
      costo: data.costo,
      lotes: data.lotes,
    }));
  }, [produccionesPeriodo, getProducto]);

  // ─────────────────────────────────────────────────────────────
  // 3b. Pie Chart: Distribución de Gastos
  // ─────────────────────────────────────────────────────────────
  const gastosDistribucion = useMemo(() => {
    const gastoCuentas = cuentas.filter(c => c.tipo === 'GASTO');
    const result: { nombre: string; value: number }[] = [];
    gastoCuentas.forEach(cuenta => {
      const saldo = detallesPeriodo
        .filter(d => d.cuenta_id === cuenta.id)
        .reduce((s, d) => s + d.debe - d.haber, 0);
      if (saldo > 0) {
        result.push({ nombre: cuenta.nombre, value: saldo });
      }
    });
    return result.sort((a, b) => b.value - a.value);
  }, [cuentas, detallesPeriodo]);

  // ─────────────────────────────────────────────────────────────
  // 4. Saldo por cuenta caja/banco
  // ─────────────────────────────────────────────────────────────
  const saldosCajaBanco = useMemo(() => {
    const cajaCuentas = cuentas.filter(c => c.es_caja_banco);
    return cajaCuentas.map(cuenta => {
      const saldo = detalles
        .filter(d => d.cuenta_id === cuenta.id)
        .reduce((s, d) => s + d.debe - d.haber, 0);
      return { nombre: cuenta.nombre, saldo };
    }).sort((a, b) => b.saldo - a.saldo);
  }, [cuentas, detalles]);

  // ─────────────────────────────────────────────────────────────
  // 5. Últimas 5 ventas
  // ─────────────────────────────────────────────────────────────
  const ultimasVentas = useMemo(() => {
    return [...ventas]
      .filter(v => v.estado === 'ACTIVA')
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5)
      .map(v => ({
        fecha: v.fecha,
        producto: getProducto(v.producto_id)?.nombre || 'Desconocido',
        cantidad: v.cantidad_vendida,
        monto: v.total_venta,
        margenPct: v.margen_porcentaje,
      }));
  }, [ventas, getProducto]);

  const periodLabels: Record<PeriodType, string> = {
    today: "Hoy",
    "7days": "7 días",
    "30days": "30 días",
    thisMonth: "Este mes",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="7days">7 días</SelectItem>
            <SelectItem value="30days">30 días</SelectItem>
            <SelectItem value="thisMonth">Este mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs (existing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Disponible Total" value={formatMoney(disponible)} icon={<Wallet className="h-5 w-5" />} color="primary" />
        <KpiCard title="Ingresos (30d)" value={formatMoney(ingresos30)} icon={<TrendingUp className="h-5 w-5" />} color="success" />
        <KpiCard title="Gastos (30d)" value={formatMoney(gastos30)} icon={<TrendingDown className="h-5 w-5" />} color="destructive" />
        <KpiCard title="Resultado (30d)" value={formatMoney(resultado30)} icon={<BarChart3 className="h-5 w-5" />} color={resultado30 >= 0 ? 'success' : 'destructive'} />
      </div>

      {/* 1. Line Chart: Ingresos vs Gastos */}
      <Card className="transition-transform hover:scale-[1.01]">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ingresos vs Gastos por día ({periodLabels[period]})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineChartData.some(d => d.Ingresos > 0 || d.Gastos > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatMoney(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Legend />
                <Line type="monotone" dataKey="Ingresos" stroke="hsl(142, 40%, 42%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Gastos" stroke="hsl(4, 65%, 52%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Utilidad" stroke="hsl(0, 0%, 60%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<TrendingUp className="h-10 w-10" />} message="No hay datos de ingresos o gastos en este período" />
          )}
        </CardContent>
      </Card>

      {/* 2. Pie + Bar side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 2a. Pie: Ventas por Producto */}
        <Card className="transition-transform hover:scale-[1.02]">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Ventas por Producto ({periodLabels[period]})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ventasPorProducto.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={ventasPorProducto}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="nombre"
                    label={({ nombre, percent }) => `${nombre} (${percent}%)`}
                    labelLine={false}
                  >
                    {ventasPorProducto.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatMoney(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<ShoppingCart className="h-10 w-10" />} message="No hay ventas en este período" />
            )}
            {ventasPorProducto.length > 0 && (
              <div className="mt-4 space-y-1 text-sm">
                {ventasPorProducto.map((item, i) => (
                  <div key={item.nombre} className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {item.nombre}
                    </span>
                    <span className="text-muted-foreground">{formatMoney(item.value)} ({item.percent}%)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2b. Bar: Costo vs Margen */}
        <Card className="transition-transform hover:scale-[1.02]">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Costo vs Margen por Producto ({periodLabels[period]})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {costoMargenData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={costoMargenData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatMoney(v)} />
                  <YAxis dataKey="nombre" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string, props: { payload?: { margenPct?: number } }) => {
                      if (name === 'Margen') return [formatMoney(value) + ` (${props.payload?.margenPct ?? 0}%)`, name];
                      return [formatMoney(value), name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Costo" stackId="a" fill="hsl(0, 0%, 70%)" />
                  <Bar dataKey="Margen" stackId="a" fill="hsl(142, 40%, 42%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<BarChart3 className="h-10 w-10" />} message="No hay datos de ventas para mostrar márgenes" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Producción + Gastos side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 3a. Producción */}
        <Card className="transition-transform hover:scale-[1.02]">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Package className="h-5 w-5" />
              Producción del período ({periodLabels[period]})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {produccionData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={produccionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="nombre" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="Unidades" fill="hsl(200, 60%, 50%)" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Producto</th>
                        <th className="text-right py-2 font-medium">Lotes</th>
                        <th className="text-right py-2 font-medium">Unidades</th>
                        <th className="text-right py-2 font-medium">Costo Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produccionData.map(p => (
                        <tr key={p.nombre} className="border-b border-border/50">
                          <td className="py-2">{p.nombre}</td>
                          <td className="text-right py-2">{p.lotes}</td>
                          <td className="text-right py-2">{p.Unidades}</td>
                          <td className="text-right py-2">{formatMoney(p.costo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState icon={<Package className="h-10 w-10" />} message="No hay producción registrada en este período" />
            )}
          </CardContent>
        </Card>

        {/* 3b. Distribución de Gastos */}
        <Card className="transition-transform hover:scale-[1.02]">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Distribución de Gastos ({periodLabels[period]})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gastosDistribucion.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={gastosDistribucion}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="nombre"
                  >
                    {gastosDistribucion.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatMoney(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<TrendingDown className="h-10 w-10" />} message="No hay gastos registrados en este período" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Saldo por cuenta caja/banco */}
      <Card className="transition-transform hover:scale-[1.01]">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Saldo por Cuenta de Caja / Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {saldosCajaBanco.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(150, saldosCajaBanco.length * 50)}>
              <BarChart data={saldosCajaBanco} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatMoney(v)} />
                <YAxis dataKey="nombre" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <defs>
                  <linearGradient id="saldoGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(142, 40%, 42%)" />
                    <stop offset="100%" stopColor="hsl(160, 50%, 45%)" />
                  </linearGradient>
                </defs>
                <Bar dataKey="saldo" fill="url(#saldoGradient)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={<Wallet className="h-10 w-10" />} message="No hay cuentas de caja/banco configuradas" />
          )}
        </CardContent>
      </Card>

      {/* Today cards (existing) */}
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

      {/* 5. Últimas ventas + Stock bajo side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas 5 ventas */}
        <Card className="transition-transform hover:scale-[1.02]">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Últimas 5 Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ultimasVentas.length > 0 ? (
              <div className="space-y-3">
                {ultimasVentas.map((v, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{v.producto}</p>
                      <p className="text-sm text-muted-foreground">{v.fecha} — {v.cantidad} uds</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold">{formatMoney(v.monto)}</p>
                      <Badge variant={v.margenPct >= 30 ? "default" : v.margenPct >= 15 ? "secondary" : "destructive"}>
                        {v.margenPct.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<ShoppingCart className="h-10 w-10" />} message="No hay ventas registradas" />
            )}
          </CardContent>
        </Card>

        {/* Stock bajo (existing) */}
        <Card className={stockBajo.length > 0 ? "border-destructive/30" : ""}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${stockBajo.length > 0 ? 'text-destructive' : ''}`} />
              Stock Bajo {stockBajo.length > 0 && `(${stockBajo.length} productos)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockBajo.length > 0 ? (
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
            ) : (
              <EmptyState icon={<Package className="h-10 w-10" />} message="Todos los productos tienen stock suficiente" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Margen por producto table (existing) */}
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
    <Card className="transition-transform hover:scale-[1.02]">
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

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="mb-3 opacity-50">{icon}</div>
      <p className="text-sm text-center">{message}</p>
    </div>
  );
}
