import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/accounting";

export default function FlujoCajaPage() {
  const { cuentas, getDetallesContabilizados, getComprobantesContabilizados, getCuenta } = useAccounting();
  const [periodo, setPeriodo] = useState("30");

  const detalles = getDetallesContabilizados();
  const comprobantes = getComprobantesContabilizados();
  const cajas = cuentas.filter(c => c.es_caja_banco);
  const cajaIds = new Set(cajas.map(c => c.id));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(periodo));
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const compIds = new Set(comprobantes.filter(c => c.fecha >= cutoffStr).map(c => c.id));
  const detsFiltered = detalles.filter(d => cajaIds.has(d.cuenta_id) && compIds.has(d.comprobante_id));

  const entradas = detsFiltered.reduce((s, d) => s + d.debe, 0);
  const salidas = detsFiltered.reduce((s, d) => s + d.haber, 0);
  const neto = entradas - salidas;

  // Per account balances (all time)
  const saldosPorCuenta = cajas.map(c => {
    const ds = detalles.filter(d => d.cuenta_id === c.id);
    const saldo = ds.reduce((s, d) => s + d.debe - d.haber, 0);
    return { cuenta: c, saldo };
  });

  // Recent movements with contrapartida
  const movements = detsFiltered.map(d => {
    const comp = comprobantes.find(c => c.id === d.comprobante_id);
    const allDetsComp = detalles.filter(dd => dd.comprobante_id === d.comprobante_id && dd.id !== d.id);
    const contrapartida = allDetsComp.map(dd => getCuenta(dd.cuenta_id)?.nombre).filter(Boolean).join(', ');
    return { ...d, comp, contrapartida };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Flujo de Caja</h1>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 días</SelectItem>
            <SelectItem value="30">30 días</SelectItem>
            <SelectItem value="90">90 días</SelectItem>
            <SelectItem value="365">1 año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Entradas</p>
            <p className="text-2xl font-display font-bold text-success">{formatMoney(entradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Salidas</p>
            <p className="text-2xl font-display font-bold text-destructive">{formatMoney(salidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saldo Neto</p>
            <p className={`text-2xl font-display font-bold ${neto >= 0 ? 'text-success' : 'text-destructive'}`}>{formatMoney(neto)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
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

      <Card>
        <CardHeader><CardTitle className="font-display">Movimientos Recientes</CardTitle></CardHeader>
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
            {movements.length === 0 && <p className="text-center text-muted-foreground py-4">Sin movimientos</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
