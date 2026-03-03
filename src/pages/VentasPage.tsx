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
import { Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function VentasPage() {
  const { productos, cuentas, stock, ventas, getProducto, getCuenta, registrarVenta, eliminarVenta, editarVenta, getStockForProducto, isMesCerrado } = useAccounting();

  const [fecha, setFecha] = useState(today());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [totalVenta, setTotalVenta] = useState("");
  const [formaCobro, setFormaCobro] = useState("");

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const cuentasCaja = cuentas.filter(c => c.es_caja_banco || c.codigo === 'A1.5');
  const stk = productoId ? getStockForProducto(productoId) : null;
  const cantNum = parseFloat(cantidad) || 0;
  const totalNum = parseFloat(totalVenta) || 0;
  const costoEst = stk ? stk.costo_promedio * cantNum : 0;
  const margen = totalNum - costoEst;
  const margenPct = totalNum > 0 ? (margen / totalNum) * 100 : 0;

  const ventasActivas = ventas.filter(v => v.estado === 'ACTIVA' || !v.estado);

  const resetForm = () => {
    setProductoId(""); setCantidad(""); setTotalVenta(""); setFormaCobro("");
    setFecha(today());
    setEditingId(null);
  };

  const handleVenta = () => {
    if (!productoId || !cantidad || !totalVenta || !formaCobro) {
      toast.error("Complete todos los campos"); return;
    }

    if (editingId) {
      // Edit mode - check mes cerrado first for better error message
      if (isMesCerrado(fecha)) {
        toast.error("No se puede editar: el mes de destino está cerrado.");
        return;
      }
      const result = editarVenta(editingId, {
        fecha, producto_id: productoId,
        cantidad_vendida: cantNum,
        total_venta: totalNum,
        forma_cobro_cuenta_id: formaCobro,
      });
      if (result) {
        toast.success("Venta actualizada correctamente");
        resetForm();
      } else {
        toast.error("Error al editar. Revise la consola para más detalles.");
      }
    } else {
      // New sale
      if (stk && cantNum > stk.cantidad_actual) {
        toast.error(`Stock insuficiente. Disponible: ${stk.cantidad_actual}`); return;
      }
      const result = registrarVenta({
        fecha, producto_id: productoId,
        cantidad_vendida: cantNum,
        total_venta: totalNum,
        forma_cobro_cuenta_id: formaCobro,
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
    setFormaCobro(v.forma_cobro_cuenta_id);
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
            <div>
              <Label>Forma de Cobro</Label>
              <Select value={formaCobro} onValueChange={setFormaCobro}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cuentasCaja.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cantNum > 0 && totalNum > 0 && (
              <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
                <div className="flex justify-between"><span>Costo estimado:</span><span>{formatMoney(costoEst)}</span></div>
                <div className="flex justify-between"><span>Margen:</span><span className={margen >= 0 ? 'text-success' : 'text-destructive'}>{formatMoney(margen)}</span></div>
                <div className="flex justify-between"><span>Margen %:</span><span>{margenPct.toFixed(1)}%</span></div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleVenta} className="flex-1">
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
          <CardHeader><CardTitle className="font-display">Historial de Ventas</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Venta</th>
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
