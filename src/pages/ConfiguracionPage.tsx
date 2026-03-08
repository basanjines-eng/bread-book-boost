import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, RefreshCw, Banknote, XCircle } from "lucide-react";
import { formatMoney, formatDate, today, generateId, generateNumero } from "@/lib/accounting";

export default function ConfiguracionPage() {
  const {
    cuentas, comprobantes, detalles, addComprobante, contabilizar, deleteComprobante,
    isMesCerrado, getDetallesForComprobante, getCuenta, getComprobantesContabilizados, getDetallesContabilizados,
  } = useAccounting();

  // ==================== RETIROS ====================
  const [retiroFecha, setRetiroFecha] = useState(today());
  const [retiroMonto, setRetiroMonto] = useState("");
  const [retiroCuentaId, setRetiroCuentaId] = useState("");
  const [retiroMotivo, setRetiroMotivo] = useState("");

  const cuentasCajaBanco = useMemo(() => cuentas.filter(c => c.es_caja_banco && c.activa), [cuentas]);
  const cRetiros = useMemo(() => cuentas.find(c => c.codigo === 'C1.3'), [cuentas]);

  // Compute saldo for caja/banco accounts from contabilized entries
  const saldosCajaBanco = useMemo(() => {
    const contabIds = new Set(comprobantes.filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at).map(c => c.id));
    const saldos: Record<string, number> = {};
    for (const d of detalles) {
      if (!contabIds.has(d.comprobante_id)) continue;
      const cuenta = cuentas.find(c => c.id === d.cuenta_id);
      if (!cuenta?.es_caja_banco) continue;
      if (!saldos[cuenta.id]) saldos[cuenta.id] = 0;
      saldos[cuenta.id] += d.debe - d.haber;
    }
    return saldos;
  }, [comprobantes, detalles, cuentas]);

  // Retiro history: comprobantes with glosa starting with "Retiro del dueño"
  const retiros = useMemo(() => {
    return comprobantes
      .filter(c => c.glosa.startsWith('Retiro del dueño') && !c.deleted_at)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(c => {
        const dets = detalles.filter(d => d.comprobante_id === c.id);
        const detCuenta = dets.find(d => d.haber > 0);
        const cuentaOrigen = detCuenta ? cuentas.find(ct => ct.id === detCuenta.cuenta_id) : undefined;
        const monto = dets.find(d => d.debe > 0)?.debe || 0;
        return { comprobante: c, monto, cuentaOrigen, estado: c.estado };
      });
  }, [comprobantes, detalles, cuentas]);

  const handleRegistrarRetiro = () => {
    const monto = parseFloat(retiroMonto);
    if (!monto || monto <= 0) { toast.error("Ingrese un monto válido"); return; }
    if (!retiroCuentaId) { toast.error("Seleccione una cuenta de origen"); return; }
    if (!cRetiros) { toast.error("No se encontró la cuenta C1.3 (Retiros del Dueño)"); return; }
    if (isMesCerrado(retiroFecha)) { toast.error("El mes de la fecha seleccionada está cerrado"); return; }

    const saldo = saldosCajaBanco[retiroCuentaId] || 0;
    const cuentaOrigen = cuentas.find(c => c.id === retiroCuentaId);
    if (saldo < monto) {
      toast.error(`Saldo insuficiente en ${cuentaOrigen?.nombre || 'cuenta'}. Disponible: ${formatMoney(saldo)}`);
      return;
    }

    const glosa = retiroMotivo ? `Retiro del dueño: ${retiroMotivo}` : 'Retiro del dueño';
    const compId = addComprobante(
      { fecha: retiroFecha, glosa, estado: 'BORRADOR' },
      [
        { cuenta_id: cRetiros.id, descripcion: glosa, debe: monto, haber: 0 },
        { cuenta_id: retiroCuentaId, descripcion: glosa, debe: 0, haber: monto },
      ]
    );
    contabilizar(compId);
    toast.success(`Retiro de ${formatMoney(monto)} registrado correctamente`);
    setRetiroMonto("");
    setRetiroMotivo("");
  };

  const handleAnularRetiro = (comprobanteId: string, fecha: string) => {
    if (isMesCerrado(fecha)) { toast.error("No se puede anular: el mes está cerrado"); return; }
    deleteComprobante(comprobanteId);
    toast.success("Retiro anulado correctamente");
  };

  const resetData = () => {
    if (confirm('¿Está seguro? Esto eliminará todos los datos.')) {
      localStorage.removeItem('panconta_data');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Configuración</h1>

      {/* ==================== RETIROS DEL DUEÑO ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Retiros del Dueño
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Formulario */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={retiroFecha} onChange={e => setRetiroFecha(e.target.value)} />
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0" value={retiroMonto} onChange={e => setRetiroMonto(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Cuenta de origen</Label>
              <Select value={retiroCuentaId} onValueChange={setRetiroCuentaId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {cuentasCajaBanco.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nombre} ({formatMoney(saldosCajaBanco[c.id] || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input value={retiroMotivo} onChange={e => setRetiroMotivo(e.target.value)} placeholder="Descripción del retiro" />
            </div>
          </div>
          <Button onClick={handleRegistrarRetiro}>
            <Banknote className="h-4 w-4 mr-2" />Registrar Retiro
          </Button>

          {/* Historial */}
          {retiros.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm mb-2 text-muted-foreground">Historial de Retiros</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta Origen</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retiros.map(r => (
                      <TableRow key={r.comprobante.id}>
                        <TableCell>{formatDate(r.comprobante.fecha)}</TableCell>
                        <TableCell className="font-mono">{formatMoney(r.monto)}</TableCell>
                        <TableCell>{r.cuentaOrigen ? `${r.cuentaOrigen.codigo} - ${r.cuentaOrigen.nombre}` : '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {r.comprobante.glosa.replace('Retiro del dueño: ', '').replace('Retiro del dueño', '—')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAnularRetiro(r.comprobante.id, r.comprobante.fecha)}
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== DATOS ==================== */}
      <Card>
        <CardHeader><CardTitle className="font-display">Datos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Los datos se almacenan localmente en el navegador. Se recomienda migrar a una base de datos para producción.
          </p>
          <div className="flex gap-4">
            <Button variant="destructive" onClick={resetData}>
              <Trash2 className="h-4 w-4 mr-2" />Reiniciar Datos
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />Recargar App
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Acerca de PanConta</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sistema de contabilidad por partida doble para panadería. 
            Versión 1.0 — Todos los cálculos se realizan automáticamente desde comprobantes contabilizados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}