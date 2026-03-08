import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/accounting";
import type { TipoCuenta } from "@/types/accounting";

export default function ReportesPage() {
  const { cuentas, getDetallesContabilizados } = useAccounting();
  const detalles = getDetallesContabilizados();

  // Calculate balance for each account
  const saldos = cuentas.filter(c => c.activa).map(c => {
    const ds = detalles.filter(d => d.cuenta_id === c.id);
    const totalDebe = ds.reduce((s, d) => s + d.debe, 0);
    const totalHaber = ds.reduce((s, d) => s + d.haber, 0);
    const saldo = (c.tipo === 'ACTIVO' || c.tipo === 'GASTO')
      ? totalDebe - totalHaber
      : totalHaber - totalDebe;
    return { cuenta: c, totalDebe, totalHaber, saldo };
  });

  const byTipo = (tipo: TipoCuenta) => saldos.filter(s => s.cuenta.tipo === tipo);
  const sumSaldo = (tipo: TipoCuenta) => byTipo(tipo).reduce((s, x) => s + x.saldo, 0);

  const totalActivos = sumSaldo('ACTIVO');
  const totalPasivos = sumSaldo('PASIVO');
  const totalPatrimonio = sumSaldo('PATRIMONIO');
  const totalIngresos = sumSaldo('INGRESO');
  const totalGastos = sumSaldo('GASTO');
  const resultado = totalIngresos - totalGastos;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Reportes</h1>

      <Tabs defaultValue="resumen">
        <TabsList className="mb-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="comprobacion">Balance Comprobación</TabsTrigger>
          <TabsTrigger value="resultados">Estado de Resultados</TabsTrigger>
          <TabsTrigger value="general">Balance General</TabsTrigger>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Activos</p><p className="text-2xl font-display font-bold">{formatMoney(totalActivos)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Pasivos</p><p className="text-2xl font-display font-bold">{formatMoney(totalPasivos)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Patrimonio</p><p className="text-2xl font-display font-bold">{formatMoney(totalPatrimonio)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Ingresos</p><p className="text-2xl font-display font-bold text-success">{formatMoney(totalIngresos)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Gastos</p><p className="text-2xl font-display font-bold text-destructive">{formatMoney(totalGastos)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Resultado</p><p className={`text-2xl font-display font-bold ${resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatMoney(resultado)}</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="comprobacion">
          <Card>
            <CardHeader><CardTitle className="font-display">Balance de Comprobación</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Código</th>
                    <th className="text-left py-2">Cuenta</th>
                    <th className="text-right py-2">Debe</th>
                    <th className="text-right py-2">Haber</th>
                    <th className="text-right py-2">Saldo Deudor</th>
                    <th className="text-right py-2">Saldo Acreedor</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.filter(s => s.totalDebe > 0 || s.totalHaber > 0).map(s => (
                    <tr key={s.cuenta.id} className="border-b border-border/50">
                      <td className="py-2 font-mono">{s.cuenta.codigo}</td>
                      <td className="py-2">{s.cuenta.nombre}</td>
                      <td className="text-right py-2">{formatMoney(s.totalDebe)}</td>
                      <td className="text-right py-2">{formatMoney(s.totalHaber)}</td>
                      <td className="text-right py-2">{s.cuenta.naturaleza === 'DEUDORA' && s.saldo > 0 ? formatMoney(s.saldo) : ''}</td>
                      <td className="text-right py-2">{s.cuenta.naturaleza === 'ACREEDORA' && s.saldo > 0 ? formatMoney(s.saldo) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={2} className="py-2">TOTALES</td>
                    <td className="text-right py-2">{formatMoney(saldos.reduce((s, x) => s + x.totalDebe, 0))}</td>
                    <td className="text-right py-2">{formatMoney(saldos.reduce((s, x) => s + x.totalHaber, 0))}</td>
                    <td className="text-right py-2">{formatMoney(saldos.filter(s => s.cuenta.naturaleza === 'DEUDORA' && s.saldo > 0).reduce((a, s) => a + s.saldo, 0))}</td>
                    <td className="text-right py-2">{formatMoney(saldos.filter(s => s.cuenta.naturaleza === 'ACREEDORA' && s.saldo > 0).reduce((a, s) => a + s.saldo, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados">
          <Card>
            <CardHeader><CardTitle className="font-display">Estado de Resultados</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-display font-semibold text-lg mb-2 text-success">INGRESOS</h3>
                {byTipo('INGRESO').map(s => (
                  <div key={s.cuenta.id} className="flex justify-between py-1 pl-4">
                    <span>{s.cuenta.nombre}</span>
                    <span>{formatMoney(s.saldo)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total Ingresos</span><span>{formatMoney(totalIngresos)}</span>
                </div>
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg mb-2 text-destructive">GASTOS</h3>
                {byTipo('GASTO').map(s => (
                  <div key={s.cuenta.id} className="flex justify-between py-1 pl-4">
                    <span>{s.cuenta.nombre}</span>
                    <span>{formatMoney(s.saldo)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total Gastos</span><span>{formatMoney(totalGastos)}</span>
                </div>
              </div>
              <div className={`flex justify-between text-xl font-display font-bold border-t-2 pt-3 ${resultado >= 0 ? 'text-success' : 'text-destructive'}`}>
                <span>RESULTADO DEL PERÍODO</span><span>{formatMoney(resultado)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle className="font-display">Balance General</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-display font-semibold text-lg mb-2">ACTIVOS</h3>
                  {byTipo('ACTIVO').map(s => (
                    <div key={s.cuenta.id} className="flex justify-between py-1 pl-4">
                      <span>{s.cuenta.nombre}</span><span>{formatMoney(s.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t pt-1 mt-2">
                    <span>Total Activos</span><span>{formatMoney(totalActivos)}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg mb-2">PASIVOS</h3>
                  {byTipo('PASIVO').map(s => (
                    <div key={s.cuenta.id} className="flex justify-between py-1 pl-4">
                      <span>{s.cuenta.nombre}</span><span>{formatMoney(s.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t pt-1 mt-2">
                    <span>Total Pasivos</span><span>{formatMoney(totalPasivos)}</span>
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2 mt-6">PATRIMONIO</h3>
                  {byTipo('PATRIMONIO').map(s => (
                    <div key={s.cuenta.id} className="flex justify-between py-1 pl-4">
                      <span>{s.cuenta.nombre}</span><span>{formatMoney(s.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 pl-4">
                    <span>Resultado del Período</span><span>{formatMoney(resultado)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1 mt-2">
                    <span>Total Pasivo + Patrimonio</span><span>{formatMoney(totalPasivos + totalPatrimonio + resultado)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saldos">
          <Card>
            <CardHeader><CardTitle className="font-display">Saldos de Todas las Cuentas</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Código</th>
                    <th className="text-left py-2">Cuenta</th>
                    <th className="text-left py-2">Tipo</th>
                    <th className="text-right py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map(s => (
                    <tr key={s.cuenta.id} className="border-b border-border/50">
                      <td className="py-2 font-mono">{s.cuenta.codigo}</td>
                      <td className="py-2">{s.cuenta.nombre}</td>
                      <td className="py-2 text-muted-foreground">{s.cuenta.tipo}</td>
                      <td className={`text-right py-2 font-medium ${s.saldo >= 0 ? '' : 'text-destructive'}`}>{formatMoney(s.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
