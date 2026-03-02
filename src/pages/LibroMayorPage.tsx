import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/accounting";

export default function LibroMayorPage() {
  const { cuentas, getDetallesContabilizados, getComprobantesContabilizados } = useAccounting();
  const [cuentaId, setCuentaId] = useState("");

  const detalles = getDetallesContabilizados();
  const comprobantes = getComprobantesContabilizados();
  const cuenta = cuentas.find(c => c.id === cuentaId);

  const movimientos = detalles
    .filter(d => d.cuenta_id === cuentaId)
    .map(d => {
      const comp = comprobantes.find(c => c.id === d.comprobante_id);
      return { ...d, comp };
    })
    .sort((a, b) => (a.comp?.fecha || '').localeCompare(b.comp?.fecha || ''));

  // Calculate running balance based on account nature
  let saldoAcum = 0;
  const conSaldo = movimientos.map(m => {
    if (cuenta?.tipo === 'ACTIVO' || cuenta?.tipo === 'GASTO') {
      saldoAcum += m.debe - m.haber;
    } else {
      saldoAcum += m.haber - m.debe;
    }
    return { ...m, saldo: saldoAcum };
  });

  const totalDebe = movimientos.reduce((s, m) => s + m.debe, 0);
  const totalHaber = movimientos.reduce((s, m) => s + m.haber, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Libro Mayor</h1>

      <div className="max-w-md">
        <Select value={cuentaId} onValueChange={setCuentaId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
          <SelectContent>
            {cuentas.filter(c => c.activa).map(c => (
              <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cuenta && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">{cuenta.codigo} - {cuenta.nombre}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {cuenta.tipo} | {cuenta.naturaleza} | Saldo: {cuenta.tipo === 'ACTIVO' || cuenta.tipo === 'GASTO' ? 'Debe - Haber' : 'Haber - Debe'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Comprobante</th>
                    <th className="text-left py-2">Concepto</th>
                    <th className="text-right py-2">Debe</th>
                    <th className="text-right py-2">Haber</th>
                    <th className="text-right py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {conSaldo.map(m => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2">{m.comp?.fecha ? formatDate(m.comp.fecha) : ''}</td>
                      <td className="py-2 font-mono text-xs">{m.comp?.numero}</td>
                      <td className="py-2">{m.descripcion || m.comp?.glosa}</td>
                      <td className="text-right py-2">{m.debe > 0 ? formatMoney(m.debe) : ''}</td>
                      <td className="text-right py-2">{m.haber > 0 ? formatMoney(m.haber) : ''}</td>
                      <td className="text-right py-2 font-medium">{formatMoney(m.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={3} className="py-2">TOTALES</td>
                    <td className="text-right py-2">{formatMoney(totalDebe)}</td>
                    <td className="text-right py-2">{formatMoney(totalHaber)}</td>
                    <td className="text-right py-2">{formatMoney(saldoAcum)}</td>
                  </tr>
                </tfoot>
              </table>
              {movimientos.length === 0 && <p className="text-center text-muted-foreground py-4">Sin movimientos</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
