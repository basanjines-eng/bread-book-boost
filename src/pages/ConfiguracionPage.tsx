import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, RefreshCw, Banknote, XCircle, BookOpen } from "lucide-react";
import { formatMoney, formatDate, today } from "@/lib/accounting";

export default function ConfiguracionPage() {
  const {
    cuentas, comprobantes, detalles, productos, addComprobante, contabilizar, deleteComprobante,
    isMesCerrado, getCuentaByCodigo, addProducto, resetContabilidad,
  } = useAccounting();

  // ==================== PRODUCTOS ====================
  const [nuevoProducto, setNuevoProducto] = useState("");
  
  const handleAddProducto = () => {
    const nombre = nuevoProducto.trim();
    if (!nombre) { return; }
    if (productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
      toast.error("Ya existe un producto con ese nombre");
      return;
    }
    addProducto(nombre);
    setNuevoProducto("");
    toast.success(`Producto "${nombre}" agregado correctamente`);
  };

  // ==================== APERTURA ====================
  const [apFecha, setApFecha] = useState(today());
  const [apCaja, setApCaja] = useState("");
  const [apBanco, setApBanco] = useState("");
  const [apInvInsumos, setApInvInsumos] = useState("");
  const [apInvProd, setApInvProd] = useState("");
  const [apOtrosActivos, setApOtrosActivos] = useState<{ nombre: string; monto: string }[]>([]);
  const [apCxP, setApCxP] = useState("");
  const [apPrestamos, setApPrestamos] = useState("");

  const existeApertura = useMemo(() =>
    comprobantes.some(c => c.glosa.startsWith('Apertura de contabilidad') && !c.deleted_at),
    [comprobantes]
  );

  const totalActivos = useMemo(() => {
    return (parseFloat(apCaja) || 0) + (parseFloat(apBanco) || 0) +
      (parseFloat(apInvInsumos) || 0) + (parseFloat(apInvProd) || 0) +
      apOtrosActivos.reduce((s, o) => s + (parseFloat(o.monto) || 0), 0);
  }, [apCaja, apBanco, apInvInsumos, apInvProd, apOtrosActivos]);

  const totalPasivos = useMemo(() =>
    (parseFloat(apCxP) || 0) + (parseFloat(apPrestamos) || 0),
    [apCxP, apPrestamos]
  );

  const capitalCalculado = totalActivos - totalPasivos;

  const handleApertura = () => {
    if (existeApertura) { toast.error("Ya existe un asiento de apertura"); return; }
    if (totalActivos <= 0) { toast.error("Ingrese al menos un activo inicial"); return; }
    if (isMesCerrado(apFecha)) { toast.error("El mes está cerrado"); return; }
    if (capitalCalculado <= 0) { toast.error("El capital debe ser positivo (Activos > Pasivos)"); return; }

    const dets: { cuenta_id: string; descripcion: string; debe: number; haber: number }[] = [];
    const addDet = (codigo: string, desc: string, monto: number, lado: 'DEBE' | 'HABER') => {
      if (monto <= 0) return;
      const c = getCuentaByCodigo(codigo);
      if (!c) return;
      dets.push({ cuenta_id: c.id, descripcion: desc, debe: lado === 'DEBE' ? monto : 0, haber: lado === 'HABER' ? monto : 0 });
    };

    // Activos (DEBE)
    addDet('A1.1', 'Saldo inicial Caja', parseFloat(apCaja) || 0, 'DEBE');
    addDet('A1.4', 'Saldo inicial Banco', parseFloat(apBanco) || 0, 'DEBE');
    addDet('A1.6', 'Saldo inicial Inventario Insumos', parseFloat(apInvInsumos) || 0, 'DEBE');
    addDet('A1.7', 'Saldo inicial Inventario Producto Terminado', parseFloat(apInvProd) || 0, 'DEBE');
    for (const otro of apOtrosActivos) {
      const monto = parseFloat(otro.monto) || 0;
      if (monto > 0 && otro.nombre.trim()) {
        // Use A1.5 (Cuentas por Cobrar) as catch-all for other assets
        const c = getCuentaByCodigo('A1.5');
        if (c) dets.push({ cuenta_id: c.id, descripcion: `Saldo inicial: ${otro.nombre}`, debe: monto, haber: 0 });
      }
    }
    // Pasivos (HABER)
    addDet('P1.1', 'Saldo inicial Cuentas por Pagar', parseFloat(apCxP) || 0, 'HABER');
    addDet('P1.2', 'Saldo inicial Préstamos', parseFloat(apPrestamos) || 0, 'HABER');
    // Capital (HABER)
    addDet('C1.1', 'Capital inicial', capitalCalculado, 'HABER');

    if (dets.length === 0) { toast.error("No hay montos para registrar"); return; }

    const compId = addComprobante(
      { fecha: apFecha, glosa: `Apertura de contabilidad — ${apFecha}`, estado: 'BORRADOR' },
      dets
    );
    contabilizar(compId);
    toast.success("Asiento de apertura registrado y contabilizado");
  };

  // ==================== RETIROS ====================
  const [retiroFecha, setRetiroFecha] = useState(today());
  const [retiroMonto, setRetiroMonto] = useState("");
  const [retiroCuentaId, setRetiroCuentaId] = useState("");
  const [retiroMotivo, setRetiroMotivo] = useState("");

  const cuentasCajaBanco = useMemo(() => cuentas.filter(c => c.es_caja_banco && c.activa), [cuentas]);
  const cRetiros = useMemo(() => cuentas.find(c => c.codigo === 'C1.3'), [cuentas]);

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
      localStorage.removeItem('panconta_empleados');
      localStorage.removeItem('panconta_planillas');
      localStorage.removeItem('panconta_activos_fijos');
      window.location.reload();
    }
  };

  const handleResetContabilidad = () => {
    const msg = '¿Seguro que querés RESETEAR la contabilidad?\n\n' +
      'Se eliminarán:\n' +
      '• Todos los comprobantes y asientos del Libro Diario\n' +
      '• Todas las ventas y producciones\n' +
      '• Todos los movimientos de insumos (entradas, salidas, ajustes)\n' +
      '• Todos los cierres mensuales\n' +
      '• Stocks de insumos y productos (vuelven a 0)\n\n' +
      'Se CONSERVAN:\n' +
      '• Insumos y sus datos\n' +
      '• Recetas\n' +
      '• Productos y plan de cuentas\n\n' +
      'Esta acción no se puede deshacer.';
    if (!confirm(msg)) return;
    if (!confirm('Confirmación final: ¿empezar contabilidad desde cero?')) return;
    resetContabilidad();
    toast.success('Contabilidad reiniciada. Podés registrar la apertura y comenzar de nuevo.');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Configuración</h1>

      {/* ==================== APERTURA ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Apertura de Contabilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {existeApertura ? (
            <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground">
              ✅ El asiento de apertura ya fue registrado. No se puede crear otro.
            </div>
          ) : (
            <>
              <div><Label>Fecha de inicio</Label><Input type="date" value={apFecha} onChange={e => setApFecha(e.target.value)} /></div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Activos Iniciales</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><Label>Caja (Bs)</Label><Input type="number" step="0.01" value={apCaja} onChange={e => setApCaja(e.target.value)} placeholder="0.00" /></div>
                  <div><Label>Banco (Bs)</Label><Input type="number" step="0.01" value={apBanco} onChange={e => setApBanco(e.target.value)} placeholder="0.00" /></div>
                  <div><Label>Inv. Insumos (Bs)</Label><Input type="number" step="0.01" value={apInvInsumos} onChange={e => setApInvInsumos(e.target.value)} placeholder="0.00" /></div>
                  <div><Label>Inv. Prod. Term. (Bs)</Label><Input type="number" step="0.01" value={apInvProd} onChange={e => setApInvProd(e.target.value)} placeholder="0.00" /></div>
                </div>

                {apOtrosActivos.map((otro, i) => (
                  <div key={i} className="flex gap-2 mt-2 items-end">
                    <div className="flex-1"><Label>Nombre</Label><Input value={otro.nombre} onChange={e => { const u = [...apOtrosActivos]; u[i].nombre = e.target.value; setApOtrosActivos(u); }} /></div>
                    <div className="w-40"><Label>Monto</Label><Input type="number" value={otro.monto} onChange={e => { const u = [...apOtrosActivos]; u[i].monto = e.target.value; setApOtrosActivos(u); }} /></div>
                    <Button variant="ghost" size="sm" onClick={() => setApOtrosActivos(apOtrosActivos.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setApOtrosActivos([...apOtrosActivos, { nombre: '', monto: '' }])}>
                  + Otro activo
                </Button>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Pasivos Iniciales</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Cuentas por Pagar (Bs)</Label><Input type="number" step="0.01" value={apCxP} onChange={e => setApCxP(e.target.value)} placeholder="0.00" /></div>
                  <div><Label>Préstamos (Bs)</Label><Input type="number" step="0.01" value={apPrestamos} onChange={e => setApPrestamos(e.target.value)} placeholder="0.00" /></div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span>Total Activos:</span><span className="font-mono">{formatMoney(totalActivos)}</span></div>
                <div className="flex justify-between"><span>Total Pasivos:</span><span className="font-mono">{formatMoney(totalPasivos)}</span></div>
                <hr className="my-1" />
                <div className="flex justify-between font-semibold text-primary"><span>Capital (calculado):</span><span className="font-mono">{formatMoney(capitalCalculado)}</span></div>
              </div>

              <Button onClick={handleApertura} disabled={totalActivos <= 0 || capitalCalculado <= 0}>
                <BookOpen className="h-4 w-4 mr-2" />Registrar Apertura
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ==================== RETIROS DEL DUEÑO ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Retiros del Dueño
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div><Label>Fecha</Label><Input type="date" value={retiroFecha} onChange={e => setRetiroFecha(e.target.value)} /></div>
            <div><Label>Monto</Label><Input type="number" step="0.01" min="0" value={retiroMonto} onChange={e => setRetiroMonto(e.target.value)} placeholder="0.00" /></div>
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
            <div><Label>Motivo (opcional)</Label><Input value={retiroMotivo} onChange={e => setRetiroMotivo(e.target.value)} placeholder="Descripción del retiro" /></div>
          </div>
          <Button onClick={handleRegistrarRetiro}><Banknote className="h-4 w-4 mr-2" />Registrar Retiro</Button>

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
                          <Button variant="ghost" size="sm" onClick={() => handleAnularRetiro(r.comprobante.id, r.comprobante.fecha)} className="text-destructive hover:text-destructive">
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

      {/* ==================== PRODUCTOS ==================== */}
      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><BookOpen className="h-5 w-5" />Productos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Agregá nuevos productos para registrar recetas, producción y ventas.
          </p>
          <div className="flex gap-2">
            <Input
              value={nuevoProducto}
              onChange={e => setNuevoProducto(e.target.value)}
              placeholder="Ej: Queque de Vainilla"
              className="max-w-xs"
              onKeyDown={e => { if (e.key === 'Enter') handleAddProducto(); }}
            />
            <Button onClick={handleAddProducto}>
              Agregar Producto
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cuenta de Ingreso</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map(p => {
                  const cuenta = cuentas.find(c => c.id === p.cuenta_ingreso_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cuenta ? `${cuenta.codigo} — ${cuenta.nombre}` : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ==================== DATOS ==================== */}
      <Card>
        <CardHeader><CardTitle className="font-display">Datos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Los datos se almacenan localmente en el navegador. Se recomienda migrar a una base de datos para producción.
          </p>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
            <h3 className="font-semibold text-sm text-destructive">Resetear contabilidad</h3>
            <p className="text-xs text-muted-foreground">
              Borra comprobantes, ventas, producciones, movimientos de insumos, cierres y stocks
              para empezar de cero. <strong>Conserva insumos, recetas, productos y plan de cuentas.</strong>
              Útil cuando pasó mucho tiempo sin registrar y querés arrancar limpio.
            </p>
            <Button variant="destructive" onClick={handleResetContabilidad}>
              <XCircle className="h-4 w-4 mr-2" />Resetear Contabilidad
            </Button>
          </div>
          <div className="flex gap-4">
            <Button variant="destructive" onClick={resetData}><Trash2 className="h-4 w-4 mr-2" />Reiniciar Datos</Button>
            <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4 mr-2" />Recargar App</Button>
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
