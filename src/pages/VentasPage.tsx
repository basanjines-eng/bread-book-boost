import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, AlertTriangle, Plus, X, RefreshCw } from "lucide-react";
import type { VentaCobro } from "@/types/accounting";

interface CobroLine {
  cuenta_id: string;
  monto: string;
}

export default function VentasPage() {
  const { productos, cuentas, ventas, getProducto, getCuenta, registrarVenta, eliminarVenta, editarVenta, recalcularCostosVentas, getStockForProducto, isMesCerrado } = useAccounting();

  const [fecha, setFecha] = useState(today());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [totalVenta, setTotalVenta] = useState("");
  const [cobros, setCobros] = useState<CobroLine[]>([{ cuenta_id: "", monto: "" }]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const cuentasCaja = cuentas.filter(c => c.es_caja_banco || c.codigo === 'A1.5');
  const stk = productoId ? getStockForProducto(productoId) : null;
  const cantNum = parseFloat(cantidad) || 0;
  const totalNum = parseFloat(totalVenta) || 0;
  const costoEst = stk ? stk.costo_promedio * cantNum : 0;
  const margen = totalNum - costoEst;
  const margenPct = totalNum > 0 ? (margen / totalNum) * 100 : 0;

  const totalDistribuido = cobros.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
  const diferencia = totalNum - totalDistribuido;

  const resetForm = () => {
    setProductoId(""); setCantidad(""); setTotalVenta("");
    setCobros([{ cuenta_id: "", monto: "" }]);
    setFecha(today());
    setEditingId(null);
  };

  const addCobroLine = () => setCobros(prev => [...prev, { cuenta_id: "", monto: "" }]);
  const removeCobroLine = (idx: number) => setCobros(prev => prev.filter((_, i) => i !== idx));
  const updateCobro = (idx: number, field: keyof CobroLine, value: string) => {
    setCobros(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleVenta = () => {
    if (!productoId || !cantidad || !totalVenta) {
      toast.error("Complete todos los campos"); return;
    }

    const cobrosValidos = cobros.filter(c => c.cuenta_id && parseFloat(c.monto) > 0);
    if (cobrosValidos.length === 0) {
      toast.error("Agregue al menos una línea de cobro"); return;
    }

    if (Math.abs(diferencia) > 0.01) {
      toast.error("La distribución del cobro debe ser igual al total de la venta"); return;
    }

    const cobrosData: VentaCobro[] = cobrosValidos.map(c => ({
      cuenta_id: c.cuenta_id,
      monto: parseFloat(c.monto),
    }));

    if (editingId) {
      if (isMesCerrado(fecha)) {
        toast.error("No se puede editar: el mes de destino está cerrado.");
        return;
      }
      const result = editarVenta(editingId, {
        fecha, producto_id: productoId,
        cantidad_vendida: cantNum,
        total_venta: totalNum,
        cobros: cobrosData,
      });
      if (result) {
        toast.success("Venta actualizada correctamente");
        resetForm();
      } else {
        toast.error("Error al editar. Revise la consola para más detalles.");
      }
    } else {
      if (stk && cantNum > stk.cantidad_actual) {
        toast.error(`Stock insuficiente. Disponible: ${stk.cantidad_actual}`); return;
      }
      const result = registrarVenta({
        fecha, producto_id: productoId,
        cantidad_vendida: cantNum,
        total_venta: totalNum,
        cobros: cobrosData,
      });
      if (result) {
        toast.success("Venta registrada y contabilizada");
        resetForm();
      } else {
        toast.error("Error al registrar la venta");
      }
    }
  };

  const handleEdit = (v: typeof ventas[0]) => {
    if (isMesCerrado(v.fecha)) {
      toast.error("No se puede editar: el mes está cerrado"); return;
    }
    setEditingId(v.id);
    setFecha(v.fecha);
    setProductoId(v.producto_id);
    setCantidad(String(v.cantidad_vendida));
    setTotalVenta(String(v.total_venta));
    if (v.cobros && v.cobros.length > 0) {
      setCobros(v.cobros.map(c => ({ cuenta_id: c.cuenta_id, monto: String(c.monto) })));
    } else {
      setCobros([{ cuenta_id: v.forma_cobro_cuenta_id, monto: String(v.total_venta) }]);
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const result = eliminarVenta(deleteTarget);
    if (result) {
      toast.success("Venta anulada. Stock y contabilidad revertidos.");
    } else {
      toast.error("No se pudo anular. Verifique que el mes no esté cerrado.");
    }
    setDeleteTarget(null);
  };

  const deleteVenta = ventas.find(v => v.id === deleteTarget);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Ventas</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {editingId ? "Editar Venta" : "Registrar Venta"}
              {editingId && <Badge variant="outline" className="text-xs">Editando</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div>
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {productos.filter(p => p.activo).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stk && <p className="text-xs text-muted-foreground mt-1">Disponible: {stk.cantidad_actual} | CPP: {formatMoney(stk.costo_promedio)}</p>}
            </div>
            <div><Label>Cantidad</Label><Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" /></div>
            <div><Label>Total Venta (Bs)</Label><Input type="number" value={totalVenta} onChange={e => setTotalVenta(e.target.value)} min="0" /></div>

            {/* Distribución del cobro */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Distribución del cobro</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCobroLine} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>

              {cobros.map((cobro, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Select value={cobro.cuenta_id} onValueChange={val => updateCobro(idx, 'cuenta_id', val)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                      <SelectContent>
                        {cuentasCaja.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    value={cobro.monto}
                    onChange={e => updateCobro(idx, 'monto', e.target.value)}
                    placeholder="Monto"
                    className="w-24 h-9 text-xs"
                    min="0"
                  />
                  {cobros.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeCobroLine(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              {totalNum > 0 && (
                <div className="p-2 rounded bg-muted text-xs space-y-1">
                  <div className="flex justify-between"><span>Total venta:</span><span>{formatMoney(totalNum)}</span></div>
                  <div className="flex justify-between"><span>Total distribuido:</span><span>{formatMoney(totalDistribuido)}</span></div>
                  <div className={`flex justify-between font-semibold ${Math.abs(diferencia) > 0.01 ? 'text-destructive' : 'text-success'}`}>
                    <span>Diferencia:</span><span>{formatMoney(diferencia)}</span>
                  </div>
                </div>
              )}
            </div>

            {cantNum > 0 && totalNum > 0 && (
              <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
                <div className="flex justify-between"><span>Costo estimado:</span><span>{formatMoney(costoEst)}</span></div>
                <div className="flex justify-between"><span>Margen:</span><span className={margen >= 0 ? 'text-success' : 'text-destructive'}>{formatMoney(margen)}</span></div>
                <div className="flex justify-between"><span>Margen %:</span><span>{margenPct.toFixed(1)}%</span></div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleVenta} className="flex-1" disabled={totalNum > 0 && Math.abs(diferencia) > 0.01}>
                {editingId ? "Guardar Cambios" : "Registrar Venta"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Historial de Ventas</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { recalcularCostosVentas(); toast.success("Costos recalculados correctamente"); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Recalcular costos
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Venta</th>
                    <th className="text-left py-2">Cobro</th>
                    <th className="text-right py-2">Costo</th>
                    <th className="text-right py-2">Margen</th>
                    <th className="text-right py-2">%</th>
                    <th className="text-center py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ventas].reverse().map(v => (
                    <tr key={v.id} className={`border-b border-border/50 ${v.estado === 'ANULADA' ? 'opacity-40 line-through' : ''}`}>
                      <td className="py-2">{formatDate(v.fecha)}</td>
                      <td className="py-2">{getProducto(v.producto_id)?.nombre}</td>
                      <td className="text-right py-2">{v.cantidad_vendida}</td>
                      <td className="text-right py-2">{formatMoney(v.total_venta)}</td>
                      <td className="py-2 text-xs">
                        {v.cobros && v.cobros.length > 1 ? (
                          <div className="space-y-0.5">
                            {v.cobros.map((c, i) => (
                              <div key={i}>{getCuenta(c.cuenta_id)?.nombre}: {formatMoney(c.monto)}</div>
                            ))}
                          </div>
                        ) : (
                          getCuenta(v.cobros?.[0]?.cuenta_id || v.forma_cobro_cuenta_id)?.nombre || '-'
                        )}
                      </td>
                      <td className="text-right py-2">{formatMoney(v.costo_total_venta)}</td>
                      <td className={`text-right py-2 ${v.margen >= 0 ? 'text-success' : 'text-destructive'}`}>{formatMoney(v.margen)}</td>
                      <td className="text-right py-2">{v.margen_porcentaje.toFixed(1)}%</td>
                      <td className="text-center py-2">
                        {(v.estado === 'ACTIVA' || !v.estado) ? (
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(v)} title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                              if (isMesCerrado(v.fecha)) { toast.error("Mes cerrado"); return; }
                              setDeleteTarget(v.id);
                            }} title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Anulada</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ventas.length === 0 && <p className="text-center text-muted-foreground py-4">Sin ventas registradas</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Anulación de Venta
            </DialogTitle>
            <DialogDescription>
              Esta acción revertirá el stock y anulará el comprobante contable asociado. Los reportes se recalcularán automáticamente.
            </DialogDescription>
          </DialogHeader>
          {deleteVenta && (
            <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
              <p><strong>Producto:</strong> {getProducto(deleteVenta.producto_id)?.nombre}</p>
              <p><strong>Cantidad:</strong> {deleteVenta.cantidad_vendida}</p>
              <p><strong>Total venta:</strong> {formatMoney(deleteVenta.total_venta)}</p>
              <p><strong>Distribución del cobro:</strong></p>
              {deleteVenta.cobros?.map((c, i) => (
                <p key={i} className="ml-2">• {getCuenta(c.cuenta_id)?.nombre}: {formatMoney(c.monto)}</p>
              ))}
              <p><strong>Costo:</strong> {formatMoney(deleteVenta.costo_total_venta)}</p>
              <p className="text-xs text-muted-foreground mt-2">Se devolverán {deleteVenta.cantidad_vendida} unidades al stock con valor de {formatMoney(deleteVenta.costo_total_venta)}.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Anular Venta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
