import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccounting } from "@/store/AccountingContext";
import { formatMoney, formatDate } from "@/lib/accounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function ImpresionMensualPage() {
  const [searchParams] = useSearchParams();
  const mesParam = searchParams.get("mes"); // YYYY-MM
  const now = new Date();

  const [anio, setAnio] = useState(() => mesParam ? parseInt(mesParam.split("-")[0]) : now.getFullYear());
  const [mes, setMes] = useState(() => mesParam ? parseInt(mesParam.split("-")[1]) : now.getMonth() + 1);

  const {
    comprobantes, detalles, cuentas,
  } = useAccounting();

  // Filter comprobantes for the selected month
  const compsMes = useMemo(() => {
    const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
    return comprobantes
      .filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at && c.fecha.startsWith(prefix))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  }, [comprobantes, anio, mes]);

  const getCuenta = (id: string) => cuentas.find(c => c.id === id);

  // Totals
  const { totalDebe, totalHaber } = useMemo(() => {
    let totalDebe = 0, totalHaber = 0;
    for (const comp of compsMes) {
      for (const det of detalles.filter(d => d.comprobante_id === comp.id)) {
        totalDebe += det.debe;
        totalHaber += det.haber;
      }
    }
    return { totalDebe, totalHaber };
  }, [compsMes, detalles]);

  // Estado de Resultados
  const resultados = useMemo(() => {
    const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
    const compsIds = new Set(
      comprobantes
        .filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at && c.fecha.startsWith(prefix))
        .map(c => c.id)
    );
    const dets = detalles.filter(d => compsIds.has(d.comprobante_id));

    const saldos: Record<string, number> = {};
    for (const d of dets) {
      const cuenta = getCuenta(d.cuenta_id);
      if (!cuenta) continue;
      if (cuenta.tipo !== 'INGRESO' && cuenta.tipo !== 'GASTO') continue;
      if (!saldos[cuenta.id]) saldos[cuenta.id] = 0;
      if (cuenta.tipo === 'INGRESO') {
        saldos[cuenta.id] += d.haber - d.debe;
      } else {
        saldos[cuenta.id] += d.debe - d.haber;
      }
    }

    const ingresos = cuentas.filter(c => c.tipo === 'INGRESO' && saldos[c.id]).map(c => ({ cuenta: c, saldo: saldos[c.id] || 0 }));
    const costoVentas = cuentas.find(c => c.codigo === 'G1.7');
    const costoVentasMonto = costoVentas ? (saldos[costoVentas.id] || 0) : 0;
    const gastosOp = cuentas.filter(c => c.tipo === 'GASTO' && c.codigo !== 'G1.7' && saldos[c.id]).map(c => ({ cuenta: c, saldo: saldos[c.id] || 0 }));

    const totalIngresos = ingresos.reduce((s, i) => s + i.saldo, 0);
    const utilidadBruta = totalIngresos - costoVentasMonto;
    const totalGastosOp = gastosOp.reduce((s, g) => s + g.saldo, 0);
    const utilidadNeta = utilidadBruta - totalGastosOp;

    return { ingresos, costoVentasMonto, gastosOp, totalIngresos, utilidadBruta, totalGastosOp, utilidadNeta };
  }, [comprobantes, detalles, cuentas, anio, mes]);

  // Balance General
  const balance = useMemo(() => {
    // All contabilizados up to end of selected month
    const endDate = `${anio}-${String(mes).padStart(2, '0')}-31`;
    const compsIds = new Set(
      comprobantes
        .filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at && c.fecha <= endDate)
        .map(c => c.id)
    );
    const dets = detalles.filter(d => compsIds.has(d.comprobante_id));

    const saldos: Record<string, number> = {};
    for (const d of dets) {
      const cuenta = getCuenta(d.cuenta_id);
      if (!cuenta) continue;
      if (!saldos[cuenta.id]) saldos[cuenta.id] = 0;
      if (cuenta.naturaleza === 'DEUDORA') {
        saldos[cuenta.id] += d.debe - d.haber;
      } else {
        saldos[cuenta.id] += d.haber - d.debe;
      }
    }

    const activos = cuentas.filter(c => c.tipo === 'ACTIVO' && saldos[c.id]).map(c => ({ cuenta: c, saldo: saldos[c.id] || 0 }));
    const pasivos = cuentas.filter(c => c.tipo === 'PASIVO' && saldos[c.id]).map(c => ({ cuenta: c, saldo: saldos[c.id] || 0 }));
    const patrimonio = cuentas.filter(c => c.tipo === 'PATRIMONIO' && saldos[c.id]).map(c => ({ cuenta: c, saldo: saldos[c.id] || 0 }));

    const totalActivos = activos.reduce((s, a) => s + a.saldo, 0);
    const totalPasivos = pasivos.reduce((s, p) => s + p.saldo, 0);
    const totalPatrimonio = patrimonio.reduce((s, p) => s + p.saldo, 0);

    return { activos, pasivos, patrimonio, totalActivos, totalPasivos, totalPatrimonio, utilidadPeriodo: resultados.utilidadNeta };
  }, [comprobantes, detalles, cuentas, anio, mes, resultados.utilidadNeta]);

  const fechaEmision = new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' });

  const handlePrint = () => window.print();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <>
      {/* Screen-only controls */}
      <div className="space-y-6 print:hidden">
        <h1 className="text-3xl font-display font-bold">Impresión Mensual</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <Label>Año</Label>
                <Select value={String(anio)} onValueChange={v => setAnio(Number(v))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mes</Label>
                <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />Exportar PDF
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {compsMes.length} comprobantes en {MESES[mes - 1]} {anio}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============ PRINTABLE CONTENT ============ */}
      <div className="print-content">

        {/* Section 1 — Header */}
        <div className="print-section">
          <div className="print-empresa-header">
            <h1>PanConta</h1>
            <p>Sistema de Contabilidad</p>
          </div>
          <h2 className="print-title">Reporte Mensual</h2>
          <table className="print-info-table">
            <tbody>
              <tr><td className="print-label">Período:</td><td>{MESES[mes - 1]} {anio}</td></tr>
              <tr><td className="print-label">Fecha de emisión:</td><td>{fechaEmision}</td></tr>
              <tr><td className="print-label">Total comprobantes:</td><td>{compsMes.length}</td></tr>
              <tr><td className="print-label">Total Debe:</td><td className="print-money">{formatMoney(totalDebe)}</td></tr>
              <tr><td className="print-label">Total Haber:</td><td className="print-money">{formatMoney(totalHaber)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Section 2 — Libro Diario */}
        <div className="print-section print-page-break">
          <h2 className="print-title">Libro Diario — {MESES[mes - 1]} {anio}</h2>
          {compsMes.length === 0 && <p className="print-empty">No hay comprobantes contabilizados en este período.</p>}
          {compsMes.map(comp => {
            const dets = detalles.filter(d => d.comprobante_id === comp.id);
            const tDebe = dets.reduce((s, d) => s + d.debe, 0);
            const tHaber = dets.reduce((s, d) => s + d.haber, 0);
            return (
              <div key={comp.id} className="print-comprobante">
                <div className="print-comp-header">
                  <strong>Comprobante N° {comp.numero}</strong> — Fecha: {formatDate(comp.fecha)}
                </div>
                <div className="print-comp-glosa">Glosa: {comp.glosa}</div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th className="print-th-left">Cuenta</th>
                      <th className="print-th-left">Descripción</th>
                      <th className="print-th-right">Debe</th>
                      <th className="print-th-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dets.map(d => {
                      const cuenta = getCuenta(d.cuenta_id);
                      return (
                        <tr key={d.id}>
                          <td>{cuenta ? `${cuenta.codigo} - ${cuenta.nombre}` : '???'}</td>
                          <td>{d.descripcion}</td>
                          <td className="print-money">{d.debe > 0 ? formatMoney(d.debe) : ''}</td>
                          <td className="print-money">{d.haber > 0 ? formatMoney(d.haber) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="print-total-row">
                      <td colSpan={2} className="print-total-label">Total:</td>
                      <td className="print-money">{formatMoney(tDebe)}</td>
                      <td className="print-money">{formatMoney(tHaber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>

        {/* Section 3 — Estado de Resultados */}
        <div className="print-section print-page-break">
          <h2 className="print-title">Estado de Resultados</h2>
          <p className="print-subtitle">Período: {MESES[mes - 1]} {anio}</p>

          <table className="print-table print-edoresultados">
            <tbody>
              <tr className="print-group-header"><td colSpan={2}>(+) Ingresos por Ventas</td></tr>
              {resultados.ingresos.map(i => (
                <tr key={i.cuenta.id}>
                  <td className="print-indent">{i.cuenta.nombre}</td>
                  <td className="print-money">{formatMoney(i.saldo)}</td>
                </tr>
              ))}
              <tr className="print-subtotal">
                <td>Total Ingresos</td>
                <td className="print-money">{formatMoney(resultados.totalIngresos)}</td>
              </tr>

              <tr className="print-group-header"><td colSpan={2}>(-) Costo de Ventas</td></tr>
              <tr>
                <td className="print-indent">Costo de Ventas</td>
                <td className="print-money">{formatMoney(resultados.costoVentasMonto)}</td>
              </tr>

              <tr className="print-result">
                <td>= Utilidad Bruta</td>
                <td className="print-money">{formatMoney(resultados.utilidadBruta)}</td>
              </tr>

              <tr className="print-group-header"><td colSpan={2}>(-) Gastos Operativos</td></tr>
              {resultados.gastosOp.map(g => (
                <tr key={g.cuenta.id}>
                  <td className="print-indent">- {g.cuenta.nombre}</td>
                  <td className="print-money">{formatMoney(g.saldo)}</td>
                </tr>
              ))}
              <tr className="print-subtotal">
                <td>Total Gastos Operativos</td>
                <td className="print-money">{formatMoney(resultados.totalGastosOp)}</td>
              </tr>

              <tr className="print-result print-final-result">
                <td><strong>= UTILIDAD NETA DEL PERÍODO</strong></td>
                <td className="print-money"><strong>{formatMoney(resultados.utilidadNeta)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4 — Balance General */}
        <div className="print-section print-page-break">
          <h2 className="print-title">Balance General</h2>
          <p className="print-subtitle">Al {lastDayOfMonth(anio, mes)}</p>

          <div className="print-balance-grid">
            <div>
              <h3 className="print-balance-title">ACTIVOS</h3>
              <table className="print-table">
                <tbody>
                  {balance.activos.map(a => (
                    <tr key={a.cuenta.id}>
                      <td>{a.cuenta.nombre}</td>
                      <td className="print-money">{formatMoney(a.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="print-total-row">
                    <td><strong>Total Activos</strong></td>
                    <td className="print-money"><strong>{formatMoney(balance.totalActivos)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <h3 className="print-balance-title">PASIVOS</h3>
              <table className="print-table">
                <tbody>
                  {balance.pasivos.map(p => (
                    <tr key={p.cuenta.id}>
                      <td>{p.cuenta.nombre}</td>
                      <td className="print-money">{formatMoney(p.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="print-subtotal">
                    <td>Total Pasivos</td>
                    <td className="print-money">{formatMoney(balance.totalPasivos)}</td>
                  </tr>
                </tfoot>
              </table>

              <h3 className="print-balance-title" style={{ marginTop: '1rem' }}>PATRIMONIO</h3>
              <table className="print-table">
                <tbody>
                  {balance.patrimonio.map(p => (
                    <tr key={p.cuenta.id}>
                      <td>{p.cuenta.nombre}</td>
                      <td className="print-money">{formatMoney(p.saldo)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Utilidad del Período</td>
                    <td className="print-money">{formatMoney(balance.utilidadPeriodo)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="print-total-row">
                    <td><strong>Total Pas. + Pat.</strong></td>
                    <td className="print-money"><strong>{formatMoney(balance.totalPasivos + balance.totalPatrimonio + balance.utilidadPeriodo)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}