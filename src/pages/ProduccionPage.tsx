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
  const {
    productos, producciones, recetas, getProducto, getRecetaInsumos, calcularCostoReceta,
    addProduccion, confirmarProduccion, editarProduccion, eliminarProduccion, canModifyProduccion,
  } = useAccounting();

  const [fecha, setFecha] = useState(today());
  const [productoId, setProductoId] = useState("");
  const [recetaId, setRecetaId] = useState("");
  const [cantidadLotes, setCantidadLotes] = useState("1");
  const [cantidadReal, setCantidadReal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activeRecetas = recetas.filter(r => r.activo && !r.deleted_at);
  const recetasForProducto = activeRecetas.filter(r => r.producto_id === productoId);

  const lotesNum = parseFloat(cantidadLotes) || 0;
  const cantRealNum = parseFloat(cantidadReal) || 0;
  const costoReceta = recetaId ? calcularCostoReceta(recetaId) : 0;
  const costoTotal = costoReceta * lotesNum;
  const costoUnit = cantRealNum > 0 ? costoTotal / cantRealNum : 0;

  const resetForm = () => {
    setEditingId(null);
    setProductoId(""); setRecetaId(""); setCantidadLotes("1"); setCantidadReal("");
    setFecha(today());
  };

  const handleAdd = () => {
    if (!productoId || cantRealNum <= 0) { toast.error("Complete todos los campos"); return; }

    if (editingId) {
      const result = editarProduccion(editingId, {
        fecha, producto_id: productoId, receta_id: recetaId || undefined,
        cantidad_lotes: lotesNum, cantidad_producida: cantRealNum,
      });
      if (result) { toast.success("Producción actualizada"); resetForm(); }
      else { const check = canModifyProduccion(editingId); toast.error(check.reason || "Error al editar"); }
    } else {
      addProduccion({
        fecha, producto_id: productoId, receta_id: recetaId || undefined,
        cantidad_lotes: lotesNum, cantidad_producida: cantRealNum, estado: 'BORRADOR',
      });
      toast.success("Producción registrada como borrador");
      setProductoId(""); setRecetaId(""); setCantidadLotes("1"); setCantidadReal("");
    }
  };

  const handleConfirmar = (id: string) => {
    const result = confirmarProduccion(id);
    if (result.ok) toast.success("Producción confirmada — stock actualizado e insumos descontados");
    else toast.error(result.faltante ? `Stock insuficiente de ${result.faltante}` : "Error al confirmar producción.");
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
    setRecetaId(prod.receta_id || "");
    setCantidadLotes(String(prod.cantidad_lotes));
    setCantidadReal(String(prod.cantidad_producida));
  };

  const handleDeleteClick = (id: string) => {
    const check = canModifyProduccion(id);
    if (!check.ok) { toast.error(check.reason!); return; }
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const result = eliminarProduccion(deleteTarget);
    if (result) toast.success("Producción eliminada");
    else toast.error("Error al eliminar");
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
            <CardTitle className="font-display">{editingId ? "Editar Producción" : "Registrar Producción"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div>
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={v => { setProductoId(v); setRecetaId(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {productos.filter(p => p.activo).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {productoId && (
              <div>
                <Label>Receta</Label>
                <Select value={recetaId} onValueChange={setRecetaId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar receta" /></SelectTrigger>
                  <SelectContent>
                    {recetasForProducto.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre_receta}</SelectItem>)}
                  </SelectContent>
                </Select>
                {recetasForProducto.length === 0 && <p className="text-xs text-muted-foreground mt-1">No hay recetas para este producto. Crea una en Recetas.</p>}
              </div>
            )}
            <div><Label>Cantidad de Lotes / Masas</Label><Input type="number" value={cantidadLotes} onChange={e => setCantidadLotes(e.target.value)} min="1" /></div>
            <div><Label>Cantidad Real Obtenida (unidades)</Label><Input type="number" value={cantidadReal} onChange={e => setCantidadReal(e.target.value)} min="0" /></div>

            {recetaId && lotesNum > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span>Costo por receta:</span><span>{formatMoney(costoReceta)}</span></div>
                <div className="flex justify-between"><span>Lotes:</span><span>x{lotesNum}</span></div>
                <div className="flex justify-between font-semibold"><span>Costo Total:</span><span>{formatMoney(costoTotal)}</span></div>
                {cantRealNum > 0 && (
                  <div className="flex justify-between font-semibold text-primary"><span>Costo Unitario:</span><span>{formatMoney(costoUnit)}</span></div>
                )}
              </div>
            )}

            {editingId ? (
              <div className="flex gap-2">
                <Button onClick={handleAdd} className="flex-1"><Check className="h-4 w-4 mr-2" />Guardar</Button>
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
                    <th className="text-left py-2">Receta</th>
                    <th className="text-right py-2">Lotes</th>
                    <th className="text-right py-2">Cant. Real</th>
                    <th className="text-right py-2">Costo Total</th>
                    <th className="text-right py-2">C. Unit.</th>
                    <th className="text-center py-2">Estado</th>
                    <th className="text-center py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeProducciones].reverse().map(p => {
                    const canMod = p.estado !== 'BORRADOR' ? canModifyProduccion(p.id) : { ok: true };
                    const receta = recetas.find(r => r.id === p.receta_id);
                    return (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="py-2">{formatDate(p.fecha)}</td>
                        <td className="py-2">{getProducto(p.producto_id)?.nombre}</td>
                        <td className="py-2 text-xs text-muted-foreground">{receta?.nombre_receta || '-'}</td>
                        <td className="text-right py-2">{p.cantidad_lotes}</td>
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
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(p.id)}
                              disabled={p.estado === 'CONFIRMADA' && !canMod.ok}
                              title={canMod.ok ? "Editar" : canMod.reason}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(p.id)}
                              disabled={p.estado === 'CONFIRMADA' && !canMod.ok}
                              title={canMod.ok ? "Eliminar" : canMod.reason}>
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

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              {deleteProduccion?.estado === 'CONFIRMADA'
                ? "Se revertirá el stock de producto terminado y los insumos descontados."
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
