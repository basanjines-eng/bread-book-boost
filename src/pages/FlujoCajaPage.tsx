import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/accounting";
import { Printer } from "lucide-react";

export default function FlujoCajaPage() {
  const { cuentas, getDetallesContabilizados, getComprobantesContabilizados, getCuenta, detalles, comprobantes } = useAccounting();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [anio, setAnio] = useState(currentYear);
  const [mes, setMes] = useState(currentMonth);

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const contabComprobantes = getComprobantesContabilizados();
  const contabDetalles = getDetallesContabilizados();

  // Filter by period
  const mesStr = String(mes).padStart(2, '0');
  const periodoInicio = `${anio}-${mesStr}-01`;
  const periodoFin = `${anio}-${mesStr}-31`;

  const compsPeriodo = useMemo(() =>
    contabComprobantes.filter(c => c.fecha >= periodoInicio && c.fecha <= periodoFin),
    [contabComprobantes, periodoInicio, periodoFin]
  );
  const compIdsPeriodo = useMemo(() => new Set(compsPeriodo.map(c => c.id)), [compsPeriodo]);
  const detsPeriodo = useMemo(() =>
    contabDetalles.filter(d => compIdsPeriodo.has(d.comprobante_id)),
    [contabDetalles, compIdsPeriodo]
  );

  // Helper: sum detalles for a code in period
  const sumCuenta = (codigo: string, lado: 'DEBE' | 'HABER' | 'NETO') => {
    const cuenta = cuentas.find(c => c.codigo === codigo);
    if (!cuenta) return 0;
    const ds = detsPeriodo.filter(d => d.cuenta_id === cuenta.id);
    if (lado === 'DEBE') return ds.reduce((s, d) => s + d.debe, 0);
    if (lado === 'HABER') return ds.reduce((s, d) => s + d.haber, 0);
    return ds.reduce((s, d) => s + d.debe - d.haber, 0);
  };

  const sumCuentasByCodigos = (codigos: string[], lado: 'NETO') => {
    return codigos.reduce((total, codigo) => {
      const cuenta = cuentas.find(c => c.codigo === codigo);
      if (!cuenta) return total;
      const ds = detsPeriodo.filter(d => d.cuenta_id === cuenta.id);
      return total + ds.reduce((s, d) => s + d.debe - d.haber, 0);
    }, 0);
  };

  // === ACTIVIDADES DE OPERACIÓN (Método Indirecto) ===
  // Utilidad neta = Ingresos - Gastos (del período)
  const ingresosCuentas = cuentas.filter(c => c.tipo === 'INGRESO');
  const gastosCuentas = cuentas.filter(c => c.tipo === 'GASTO');

  const totalIngresos = ingresosCuentas.reduce((s, c) => {
    const ds = detsPeriodo.filter(d => d.cuenta_id === c.id);
    return s + ds.reduce((sum, d) => sum + d.haber - d.debe, 0);
  }, 0);

  const totalGastos = gastosCuentas.reduce((s, c) => {
    const ds = detsPeriodo.filter(d => d.cuenta_id === c.id);
    return s + ds.reduce((sum, d) => sum + d.debe - d.haber, 0);
  }, 0);

  const utilidadNeta = totalIngresos - totalGastos;

  // Ajustes
  const depreciacion = sumCuenta('G1.11', 'NETO'); // Non-cash expense, add back
  const cambioCtasCobrar = -sumCuenta('A1.5', 'NETO'); // Increase in asset = negative
  const cambioInvInsumos = -sumCuenta('A1.6', 'NETO');
  const cambioInvProd = -sumCuenta('A1.7', 'NETO');
  const cambioInventarios = cambioInvInsumos + cambioInvProd;
  const cambioCxP = sumCuentasByCodigos(['P1.1', 'P1.4', 'P1.5', 'P1.6', 'P1.7'], 'NETO');
  // For pasivos, increase = positive (they increase on HABER)
  const cambioPasivosOp = (() => {
    const codigosPasivos = ['P1.1', 'P1.4', 'P1.5', 'P1.6', 'P1.7'];
    return codigosPasivos.reduce((total, codigo) => {
      const cuenta = cuentas.find(c => c.codigo === codigo);
      if (!cuenta) return total;
      const ds = detsPeriodo.filter(d => d.cuenta_id === cuenta.id);
      return total + ds.reduce((s, d) => s + d.haber - d.debe, 0);
    }, 0);
  })();

  const efectivoOperacion = utilidadNeta + depreciacion + cambioCtasCobrar + cambioInventarios + cambioPasivosOp;

  // === ACTIVIDADES DE INVERSIÓN ===
  const compraActivosFijos = -(sumCuentasByCodigos(['A2.1', 'A2.2', 'A2.3'], 'NETO'));
  const efectivoInversion = -compraActivosFijos; // purchases are negative

  // Wait, let me recalculate: A2.x debits = purchases, so neto positive means we bought
  const activosFijosNeto = sumCuentasByCodigos(['A2.1', 'A2.2', 'A2.3'], 'NETO');
  const efectivoInversionCalc = -activosFijosNeto; // Buying assets reduces cash

  // === ACTIVIDADES DE FINANCIAMIENTO ===
  const prestamosRecibidos = (() => {
    const codigos = ['P1.2', 'P1.3'];
    return codigos.reduce((total, codigo) => {
      const cuenta = cuentas.find(c => c.codigo === codigo);
      if (!cuenta) return total;
      const ds = detsPeriodo.filter(d => d.cuenta_id === cuenta.id);
      return total + ds.reduce((s, d) => s + d.haber - d.debe, 0);
    }, 0);
  })();

  const retirosDelDueno = sumCuenta('C1.3', 'NETO'); // Debits to retiros = negative for cash
  const efectivoFinanciamiento = prestamosRecibidos - retirosDelDueno;

  const variacionNeta = efectivoOperacion + efectivoInversionCalc + efectivoFinanciamiento;

  // Saldo inicial de efectivo (all cash accounts before periodo)
  const cajas = cuentas.filter(c => c.es_caja_banco);
  const compsAntes = contabComprobantes.filter(c => c.fecha < periodoInicio);
  const compIdsAntes = new Set(compsAntes.map(c => c.id));
  const saldoInicial = cajas.reduce((total, cuenta) => {
    const ds = contabDetalles.filter(d => d.cuenta_id === cuenta.id && compIdsAntes.has(d.comprobante_id));
    return total + ds.reduce((s, d) => s + d.debe - d.haber, 0);
  }, 0);

  const saldoFinal = saldoInicial + variacionNeta;

  // Also keep the simple cash flow view
  const compIdsPer = compIdsPeriodo;
  const cajaIds = new Set(cajas.map(c => c.id));
  const detsFiltered = contabDetalles.filter(d => cajaIds.has(d.cuenta_id) && compIdsPer.has(d.comprobante_id));
  const entradas = detsFiltered.reduce((s, d) => s + d.debe, 0);
  const salidas = detsFiltered.reduce((s, d) => s + d.haber, 0);

  // Per account balances (all time)
  const saldosPorCuenta = cajas.map(c => {
    const ds = contabDetalles.filter(d => d.cuenta_id === c.id);
    const saldo = ds.reduce((s, d) => s + d.debe - d.haber, 0);
    return { cuenta: c, saldo };
  });

  // Recent movements
  const movements = detsFiltered.map(d => {
    const comp = contabComprobantes.find(c => c.id === d.comprobante_id);
    const allDetsComp = contabDetalles.filter(dd => dd.comprobante_id === d.comprobante_id && dd.id !== d.id);
    const contrapartida = allDetsComp.map(dd => getCuenta(dd.cuenta_id)?.nombre).filter(Boolean).join(', ');
    return { ...d, comp, contrapartida };
  });

  const renderLine = (label: string, value: number, indent = 0, bold = false) => (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-semibold' : ''}`} style={{ paddingLeft: `${indent * 16}px` }}>
      <span>{label}</span>
      <span className={`font-mono ${value < 0 ? 'text-destructive' : ''}`}>
        {value < 0 ? `(${formatMoney(Math.abs(value))})` : formatMoney(value)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-display font-bold">Flujo de Caja</h1>
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={v => setMes(parseInt(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.slice(1).map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(anio)} onValueChange={v => setAnio(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />Imprimir
          </Button>
        </div>
      </div>

      {/* Summary cards - print hidden */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Entradas del mes</p>
            <p className="text-2xl font-display font-bold text-success">{formatMoney(entradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Salidas del mes</p>
            <p className="text-2xl font-display font-bold text-destructive">{formatMoney(salidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saldo Neto Período</p>
            <p className={`text-2xl font-display font-bold ${entradas - salidas >= 0 ? 'text-success' : 'text-destructive'}`}>{formatMoney(entradas - salidas)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de Flujo de Efectivo - NB-NIIF */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display text-center">
            <div className="print-header">
              <div className="text-lg font-bold">PanConta</div>
              <div className="text-base">ESTADO DE FLUJO DE EFECTIVO</div>
              <div className="text-sm font-normal text-muted-foreground">Período: {meses[mes]} {anio} — Método Indirecto</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* Operación */}
          <div>
            <div className="font-bold text-sm border-b pb-1 mb-2">ACTIVIDADES DE OPERACIÓN</div>
            {renderLine('Utilidad neta del período', utilidadNeta, 1)}
            <div className="text-xs text-muted-foreground ml-4 mt-1 mb-1">Ajustes por partidas no monetarias:</div>
            {renderLine('(+) Depreciación', depreciacion, 2)}
            {renderLine('(+/-) Cambio en Cuentas por Cobrar', cambioCtasCobrar, 2)}
            {renderLine('(+/-) Cambio en Inventarios', cambioInventarios, 2)}
            {renderLine('(+/-) Cambio en Pasivos Operativos', cambioPasivosOp, 2)}
            <div className="border-t mt-2 pt-1">
              {renderLine('= Efectivo de actividades de operación', efectivoOperacion, 1, true)}
            </div>
          </div>

          {/* Inversión */}
          <div>
            <div className="font-bold text-sm border-b pb-1 mb-2">ACTIVIDADES DE INVERSIÓN</div>
            {renderLine('Compra de activos fijos', -activosFijosNeto, 1)}
            <div className="border-t mt-2 pt-1">
              {renderLine('= Efectivo de actividades de inversión', efectivoInversionCalc, 1, true)}
            </div>
          </div>

          {/* Financiamiento */}
          <div>
            <div className="font-bold text-sm border-b pb-1 mb-2">ACTIVIDADES DE FINANCIAMIENTO</div>
            {renderLine('Préstamos recibidos / pagados', prestamosRecibidos, 1)}
            {renderLine('Retiros del dueño', -retirosDelDueno, 1)}
            <div className="border-t mt-2 pt-1">
              {renderLine('= Efectivo de actividades de financiamiento', efectivoFinanciamiento, 1, true)}
            </div>
          </div>

          {/* Resumen */}
          <div className="border-t-2 border-foreground pt-2 space-y-1">
            {renderLine('VARIACIÓN NETA DE EFECTIVO', variacionNeta, 0, true)}
            {renderLine('Saldo inicial de efectivo', saldoInicial, 0)}
            <div className="border-t-2 border-foreground pt-1">
              {renderLine('SALDO FINAL DE EFECTIVO', saldoFinal, 0, true)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saldos por cuenta - print hidden */}
      <Card className="print:hidden">
        <CardHeader><CardTitle className="font-display">Saldos por Cuenta</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {saldosPorCuenta.map(s => (
              <div key={s.cuenta.id} className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="font-medium">{s.cuenta.codigo} - {s.cuenta.nombre}</span>
                <span className={`font-display font-bold ${s.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatMoney(s.saldo)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Movimientos */}
      <Card className="print:hidden">
        <CardHeader><CardTitle className="font-display">Movimientos del Período</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Cuenta</th>
                  <th className="text-left py-2">Concepto</th>
                  <th className="text-left py-2">Contrapartida</th>
                  <th className="text-right py-2">Entrada</th>
                  <th className="text-right py-2">Salida</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 50).map(m => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-2">{m.comp?.fecha}</td>
                    <td className="py-2">{getCuenta(m.cuenta_id)?.nombre}</td>
                    <td className="py-2">{m.descripcion || m.comp?.glosa}</td>
                    <td className="py-2 text-muted-foreground">{m.contrapartida}</td>
                    <td className="text-right py-2">{m.debe > 0 ? formatMoney(m.debe) : ''}</td>
                    <td className="text-right py-2">{m.haber > 0 ? formatMoney(m.haber) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && <p className="text-center text-muted-foreground py-4">Sin movimientos en el período</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
