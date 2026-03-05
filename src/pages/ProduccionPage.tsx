import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import { Check, Plus, Pencil, Trash2, X } from "lucide-react";

export default function ProduccionPage() {
  const { productos, producciones, addProduccion, confirmarProduccion, editarProduccion, eliminarProduccion, canModifyProduccion, getProducto } = useAccounting();

  const [fecha, setFecha] = useState(today());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoTotal, setCostoTotal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const cantNum = parseFloat(cantidad) || 0;
  const costoNum = parseFloat(costoTotal) || 0;
  const costoUnit = cantNum > 0 ? costoNum / cantNum : 0;

  const resetForm = () => {
    setEditingId(null);
    setProductoId("");
    setCantidad("");
    setCostoTotal("");
    setFecha(today());
  };

  const handleAdd = () => {
    if (!productoId || cantNum <= 0 || costoNum <= 0) {
      toast.error("Complete todos los campos"); return;
    }

    if (editingId) {
      const result = editarProduccion(editingId, {
        fecha, producto_id: productoId,
        cantidad_producida: cantNum,
        costo_total_produccion: costoNum,
      });
      if (result) {
        toast.success("Producción actualizada correctamente");
        resetForm();
      } else {
        const check = canModifyProduccion(editingId);
        toast.error(check.reason || "Error al editar producción.");
      }
    } else {
      addProduccion({ fecha, producto_id: productoId, cantidad_producida: cantNum, costo_total_produccion: costoNum, estado: 'BORRADOR' });
      toast.success("Producción registrada");
      setProductoId(""); setCantidad(""); setCostoTotal("");
    }
  };

  const handleConfirmar = (id: string) => {
    confirmarProduccion(id);
    toast.success("Producción confirmada y contabilizada");
  };

  const handleEdit = (id: string) => {
    const prod = producciones.find(p => p.id === id);
    if (!prod) return;

    if (prod.estado === 'CONFIRMADA') {
      const check = canModifyProduccion(id);
      if (!check.ok) { toast.error(check.reason!); return; }
    }

    setEditingId(id);
    setFecha(prod.fecha);
    setProductoId(prod.producto_id);
    setCantidad(String(prod.cantidad_producida));
    setCostoTotal(String(prod.costo_total_produccion));
  };

  const handleDeleteClick = (id: string) => {
    const check = canModifyProduccion(id);
    if (!check.ok) { toast.error(check.reason!); return; }
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const result = eliminarProduccion(deleteTarget);
    if (result) {
      toast.success("Producción eliminada correctamente");
    } else {
      const check = canModifyProduccion(deleteTarget);
      toast.error(check.reason || "Error al eliminar producción.");
    }
    setDeleteTarget(null);
  };

  const deleteProduccion = deleteTarget ? producciones.find(p => p.id === deleteTarget) : null;

  const activeProducciones = producciones.filter(p => !p.deleted_at && p.estado !== 'ANULADA');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Producción</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">
              {editingId ? "Editar Producción" : "Registrar Producción"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div>
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {productos.filter(p => p.activo).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cantidad Producida</Label><Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" /></div>
            <div><Label>Costo Total Producción (Bs)</Label><Input type="number" value={costoTotal} onChange={e => setCostoTotal(e.target.value)} min="0" /></div>
            {cantNum > 0 && costoNum > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                Costo Unitario: <strong>{formatMoney(costoUnit)}</strong>
              </div>
            )}
            {editingId ? (
              <div className="flex gap-2">
                <Button onClick={handleAdd} className="flex-1"><Check className="h-4 w-4 mr-2" />Guardar cambios</Button>
                <Button onClick={resetForm} variant="outline"><X className="h-4 w-4 mr-2" />Cancelar</Button>
              </div>
            ) : (
              <Button onClick={handleAdd} className="w-full"><Plus className="h-4 w-4 mr-2" />Registrar</Button>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Historial de Producción</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cantidad</th>
                    <th className="text-right py-2">Costo Total</th>
                    <th className="text-right py-2">C. Unit.</th>
                    <th className="text-center py-2">Estado</th>
                    <th className="text-center py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeProducciones].reverse().map(p => {
                    const canMod = p.estado !== 'BORRADOR' ? canModifyProduccion(p.id) : { ok: true };
                    return (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="py-2">{formatDate(p.fecha)}</td>
                        <td className="py-2">{getProducto(p.producto_id)?.nombre}</td>
                        <td className="text-right py-2">{p.cantidad_producida}</td>
                        <td className="text-right py-2">{formatMoney(p.costo_total_produccion)}</td>
                        <td className="text-right py-2">{formatMoney(p.costo_unitario)}</td>
                        <td className="text-center py-2">
                          <Badge variant={p.estado === 'CONFIRMADA' ? 'default' : 'secondary'}>{p.estado}</Badge>
                        </td>
                        <td className="text-center py-2">
                          <div className="flex items-center justify-center gap-1">
                            {p.estado === 'BORRADOR' && (
                              <Button size="sm" variant="ghost" onClick={() => handleConfirmar(p.id)} title="Confirmar">
                                <Check className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => handleEdit(p.id)}
                              disabled={p.estado === 'CONFIRMADA' && !canMod.ok}
                              title={canMod.ok ? "Editar" : canMod.reason}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => handleDeleteClick(p.id)}
                              disabled={p.estado === 'CONFIRMADA' && !canMod.ok}
                              title={canMod.ok ? "Eliminar" : canMod.reason}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {activeProducciones.length === 0 && <p className="text-center text-muted-foreground py-4">Sin producciones</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              {deleteProduccion?.estado === 'CONFIRMADA'
                ? "Esta acción revertirá el stock y anulará el comprobante contable asociado a esta producción. Esta operación no se puede deshacer."
                : "Se eliminará este borrador de producción."}
            </DialogDescription>
          </DialogHeader>
          {deleteProduccion && (
            <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
              <p><strong>Producto:</strong> {getProducto(deleteProduccion.producto_id)?.nombre}</p>
              <p><strong>Cantidad:</strong> {deleteProduccion.cantidad_producida}</p>
              <p><strong>Costo Total:</strong> {formatMoney(deleteProduccion.costo_total_produccion)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
