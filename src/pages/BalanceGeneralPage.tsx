import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatMoney, today } from "@/lib/accounting";
import { Printer, CheckCircle, XCircle } from "lucide-react";

export default function BalanceGeneralPage() {
  const { cuentas, comprobantes, detalles } = useAccounting();
  const [fecha, setFecha] = useState(today());

  // Get contabilized comprobantes up to date
  const comps = comprobantes.filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at && c.fecha <= fecha);
  const compIds = new Set(comps.map(c => c.id));
  const dets = detalles.filter(d => compIds.has(d.comprobante_id));

  // Calculate saldo per cuenta respecting naturaleza
  const saldoPorCuenta = new Map<string, number>();
  for (const d of dets) {
    const prev = saldoPorCuenta.get(d.cuenta_id) || 0;
    const cuenta = cuentas.find(c => c.id === d.cuenta_id);
    if (!cuenta) continue;
    // Deudora: saldo = debe - haber | Acreedora: saldo = haber - debe
    if (cuenta.naturaleza === 'DEUDORA') {
      saldoPorCuenta.set(d.cuenta_id, prev + d.debe - d.haber);
    } else {
      saldoPorCuenta.set(d.cuenta_id, prev + d.haber - d.debe);
    }
  }

  const cuentasActivo = cuentas.filter(c => c.tipo === 'ACTIVO' && c.activa);
  const cuentasPasivo = cuentas.filter(c => c.tipo === 'PASIVO' && c.activa);
  const cuentasPatrimonio = cuentas.filter(c => c.tipo === 'PATRIMONIO' && c.activa);
  const cuentasIngreso = cuentas.filter(c => c.tipo === 'INGRESO' && c.activa);
  const cuentasGasto = cuentas.filter(c => c.tipo === 'GASTO' && c.activa);

  const totalActivos = cuentasActivo.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);
  const totalPasivos = cuentasPasivo.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);
  const totalPatrimonioCuentas = cuentasPatrimonio.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);

  // Utilidad del período = ingresos - gastos (dynamically calculated)
  const totalIngresos = cuentasIngreso.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);
  const totalGastos = cuentasGasto.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);
  const utilidadPeriodo = totalIngresos - totalGastos;

  const totalPatrimonio = totalPatrimonioCuentas + utilidadPeriodo;
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonio;
  const cuadra = Math.abs(totalActivos - totalPasivoPatrimonio) < 0.01;

  const renderSection = (title: string, cuentasList: typeof cuentas, extra?: React.ReactNode) => (
    <div>
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {cuentasList.map(c => {
        const saldo = saldoPorCuenta.get(c.id) || 0;
        if (saldo === 0) return null;
        return (
          <div key={c.id} className="flex justify-between py-1 px-4 text-sm">
            <span>{c.codigo} — {c.nombre}</span>
            <span>{formatMoney(saldo)}</span>
          </div>
        );
      })}
      {extra}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-display font-bold">Balance General</h1>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" />Imprimir
        </Button>
      </div>

      <div className="flex gap-3 items-end print:hidden">
        <div>
          <Label className="text-xs">Fecha de corte</Label>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-[180px]" />
        </div>
      </div>

      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">PanConta — Balance General</h2>
        <p className="text-sm text-muted-foreground">Al {new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO')}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Al {new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' })}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* ACTIVOS */}
          {renderSection('ACTIVOS', cuentasActivo)}
          <div className="flex justify-between py-2 px-4 font-bold border-t border-border">
            <span>Total Activos</span>
            <span>{formatMoney(totalActivos)}</span>
          </div>

          <div className="border-t-2 border-border" />

          {/* PASIVOS */}
          {renderSection('PASIVOS', cuentasPasivo)}
          <div className="flex justify-between py-1 px-4 font-bold border-t border-border">
            <span>Total Pasivos</span>
            <span>{formatMoney(totalPasivos)}</span>
          </div>

          {/* PATRIMONIO */}
          {renderSection('PATRIMONIO', cuentasPatrimonio,
            <div className="flex justify-between py-1 px-4 text-sm italic">
              <span>Utilidad del Período (calculada)</span>
              <span className={utilidadPeriodo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatMoney(utilidadPeriodo)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 px-4 font-bold border-t border-border">
            <span>Total Patrimonio</span>
            <span>{formatMoney(totalPatrimonio)}</span>
          </div>

          <div className="border-t-2 border-border" />

          {/* TOTAL P+P */}
          <div className="flex justify-between py-2 px-4 font-bold text-base">
            <span>Total Pasivos + Patrimonio</span>
            <span>{formatMoney(totalPasivoPatrimonio)}</span>
          </div>

          {/* Balance check */}
          <div className={`flex items-center gap-2 py-3 px-4 rounded-md text-sm font-medium ${cuadra ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
            {cuadra ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {cuadra
              ? `El balance cuadra: Activos (${formatMoney(totalActivos)}) = Pasivos + Patrimonio (${formatMoney(totalPasivoPatrimonio)})`
              : `El balance NO cuadra: Activos (${formatMoney(totalActivos)}) ≠ Pasivos + Patrimonio (${formatMoney(totalPasivoPatrimonio)}) — Diferencia: ${formatMoney(Math.abs(totalActivos - totalPasivoPatrimonio))}`
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
