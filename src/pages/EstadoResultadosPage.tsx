import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounting";
import { Printer } from "lucide-react";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function EstadoResultadosPage() {
  const { cuentas, getComprobantesContabilizados, detalles } = useAccounting();
  const now = new Date();
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1));

  const anioNum = parseInt(anio);
  const mesNum = parseInt(mes);
  const mesStr = String(mesNum).padStart(2, '0');
  const prefix = `${anioNum}-${mesStr}`;

  // Get contabilized comprobantes for the period
  const comps = getComprobantesContabilizados().filter(c => c.fecha.startsWith(prefix));
  const compIds = new Set(comps.map(c => c.id));
  const dets = detalles.filter(d => compIds.has(d.comprobante_id));

  // Calculate saldo per cuenta
  const saldoPorCuenta = new Map<string, number>();
  for (const d of dets) {
    const prev = saldoPorCuenta.get(d.cuenta_id) || 0;
    const cuenta = cuentas.find(c => c.id === d.cuenta_id);
    if (!cuenta) continue;
    // For INGRESO: naturaleza ACREEDORA → saldo = haber - debe
    // For GASTO: naturaleza DEUDORA → saldo = debe - haber
    if (cuenta.tipo === 'INGRESO') {
      saldoPorCuenta.set(d.cuenta_id, prev + d.haber - d.debe);
    } else if (cuenta.tipo === 'GASTO') {
      saldoPorCuenta.set(d.cuenta_id, prev + d.debe - d.haber);
    }
  }

  const cuentasIngreso = cuentas.filter(c => c.tipo === 'INGRESO' && c.activa);
  const costoVentas = cuentas.find(c => c.codigo === 'G1.7');
  const cuentasGasto = cuentas.filter(c => c.tipo === 'GASTO' && c.activa && c.codigo !== 'G1.7');

  const totalIngresos = cuentasIngreso.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);
  const totalCostoVentas = costoVentas ? (saldoPorCuenta.get(costoVentas.id) || 0) : 0;
  const utilidadBruta = totalIngresos - totalCostoVentas;
  const totalGastos = cuentasGasto.reduce((s, c) => s + (saldoPorCuenta.get(c.id) || 0), 0);
  const utilidadNeta = utilidadBruta - totalGastos;

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-display font-bold">Estado de Resultados</h1>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" />Imprimir
        </Button>
      </div>

      <div className="flex gap-3 print:hidden">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={anio} onValueChange={setAnio}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">PanConta — Estado de Resultados</h2>
        <p className="text-sm text-muted-foreground">{MESES[mesNum - 1]} {anioNum}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">{MESES[mesNum - 1]} {anioNum}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Ingresos */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">(+) Ingresos por Ventas</h3>
            {cuentasIngreso.map(c => {
              const saldo = saldoPorCuenta.get(c.id) || 0;
              if (saldo === 0) return null;
              return (
                <div key={c.id} className="flex justify-between py-1 px-4 text-sm">
                  <span>{c.codigo} — {c.nombre}</span>
                  <span>{formatMoney(saldo)}</span>
                </div>
              );
            })}
            <div className="flex justify-between py-1 px-4 font-bold border-t border-border mt-1">
              <span>Total Ingresos</span>
              <span>{formatMoney(totalIngresos)}</span>
            </div>
          </div>

          {/* Costo de Ventas */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">(-) Costo de Ventas</h3>
            {costoVentas && (
              <div className="flex justify-between py-1 px-4 text-sm">
                <span>{costoVentas.codigo} — {costoVentas.nombre}</span>
                <span>{formatMoney(totalCostoVentas)}</span>
              </div>
            )}
          </div>

          {/* Utilidad Bruta */}
          <div className={`flex justify-between py-2 px-4 font-bold text-base rounded-md ${utilidadBruta >= 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
            <span>= Utilidad Bruta</span>
            <span>{formatMoney(utilidadBruta)}</span>
          </div>

          {/* Gastos Operativos */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">(-) Gastos Operativos</h3>
            {cuentasGasto.map(c => {
              const saldo = saldoPorCuenta.get(c.id) || 0;
              if (saldo === 0) return null;
              return (
                <div key={c.id} className="flex justify-between py-1 px-4 text-sm">
                  <span>{c.codigo} — {c.nombre}</span>
                  <span>{formatMoney(saldo)}</span>
                </div>
              );
            })}
            <div className="flex justify-between py-1 px-4 font-bold border-t border-border mt-1">
              <span>Total Gastos Operativos</span>
              <span>{formatMoney(totalGastos)}</span>
            </div>
          </div>

          {/* Utilidad Neta */}
          <div className={`flex justify-between py-3 px-4 font-bold text-lg rounded-md ${utilidadNeta >= 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
            <span>= Utilidad Neta del Período</span>
            <span>{formatMoney(utilidadNeta)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
