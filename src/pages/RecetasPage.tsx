import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/accounting";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface IngredienteLine {
  insumo_id: string;
  cantidad_usada: string;
  unidad_medida: string;
}

export default function RecetasPage() {
  const {
    recetas, productos, insumos, getProducto, getInsumo, getStockForInsumo,
    addReceta, updateReceta, deleteReceta, getRecetaInsumos, calcularCostoReceta,
  } = useAccounting();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formProductoId, setFormProductoId] = useState("");
  const [ingredientes, setIngredientes] = useState<IngredienteLine[]>([{ insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activeRecetas = recetas.filter(r => !r.deleted_at && r.activo);

  const resetForm = () => {
    setEditingId(null);
    setFormNombre(""); setFormProductoId("");
    setIngredientes([{ insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
    setShowForm(false);
  };

  const addLine = () => setIngredientes(prev => [...prev, { insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
  const removeLine = (idx: number) => setIngredientes(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof IngredienteLine, value: string) => {
    setIngredientes(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      if (field === 'insumo_id') {
        const ins = insumos.find(ii => ii.id === value);
        if (ins) updated.unidad_medida = ins.unidad_base;
      }
      return updated;
    }));
  };

  const handleSave = () => {
    if (!formNombre || !formProductoId) { toast.error("Nombre y producto son obligatorios"); return; }
    const validIngredientes = ingredientes.filter(l => l.insumo_id && parseFloat(l.cantidad_usada) > 0);
    if (validIngredientes.length === 0) { toast.error("Agregue al menos un ingrediente"); return; }

    const ingData = validIngredientes.map(l => ({
      insumo_id: l.insumo_id,
      cantidad_usada: parseFloat(l.cantidad_usada),
      unidad_medida: l.unidad_medida,
    }));

    if (editingId) {
      updateReceta(editingId, { nombre_receta: formNombre, producto_id: formProductoId }, ingData);
      toast.success("Receta actualizada");
    } else {
      addReceta({ nombre_receta: formNombre, producto_id: formProductoId, activo: true }, ingData);
      toast.success("Receta creada");
    }
    resetForm();
  };

  const handleEdit = (id: string) => {
    const r = recetas.find(x => x.id === id);
    if (!r) return;
    const ings = getRecetaInsumos(id);
    setEditingId(id);
    setFormNombre(r.nombre_receta);
    setFormProductoId(r.producto_id);
    setIngredientes(ings.length > 0 ? ings.map(i => ({
      insumo_id: i.insumo_id,
      cantidad_usada: String(i.cantidad_usada),
      unidad_medida: i.unidad_medida,
    })) : [{ insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
    setShowForm(true);
  };

  const costoTotal = (recetaId: string) => calcularCostoReceta(recetaId);

  // Calculate cost in form
  const formCosto = ingredientes.reduce((total, l) => {
    if (!l.insumo_id || !l.cantidad_usada) return total;
    const stk = getStockForInsumo(l.insumo_id);
    return total + (parseFloat(l.cantidad_usada) || 0) * (stk?.costo_promedio || 0);
  }, 0);

  const activeInsumos = insumos.filter(i => i.activo && !i.deleted_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Recetas</h1>
        <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus className="h-4 w-4 mr-1" />Nueva Receta</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeRecetas.map(r => {
          const prod = getProducto(r.producto_id);
          const ings = getRecetaInsumos(r.id);
          const costo = costoTotal(r.id);
          return (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center justify-between text-lg">
                  {r.nombre_receta}
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(r.id)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r.id)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardTitle>
                <Badge variant="outline" className="text-xs w-fit">{prod?.nombre || '-'}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  {ings.map(ing => {
                    const ins = getInsumo(ing.insumo_id);
                    const stk = getStockForInsumo(ing.insumo_id);
                    const costoIng = ing.cantidad_usada * (stk?.costo_promedio || 0);
                    return (
                      <div key={ing.id} className="flex justify-between text-sm">
                        <span>{ins?.nombre || '-'} ({ing.cantidad_usada} {ing.unidad_medida})</span>
                        <span className="text-muted-foreground">{formatMoney(costoIng)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t flex justify-between font-semibold">
                  <span>Costo Total Receta</span>
                  <span className="text-primary">{formatMoney(costo)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {activeRecetas.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay recetas creadas. Crea tu primera receta para empezar.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => !v && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Receta" : "Nueva Receta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nombre de la Receta *</Label><Input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Masa Pan" /></div>
              <div>
                <Label>Producto Asociado *</Label>
                <Select value={formProductoId} onValueChange={setFormProductoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {productos.filter(p => p.activo).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Ingredientes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Agregar</Button>
              </div>
              {ingredientes.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Select value={line.insumo_id} onValueChange={v => updateLine(idx, 'insumo_id', v)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Insumo" /></SelectTrigger>
                      <SelectContent>
                        {activeInsumos.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="number" value={line.cantidad_usada} onChange={e => updateLine(idx, 'cantidad_usada', e.target.value)} placeholder="Cant." className="w-20 h-9 text-xs" min="0" step="0.01" />
                  <Input value={line.unidad_medida} onChange={e => updateLine(idx, 'unidad_medida', e.target.value)} placeholder="Unid." className="w-24 h-9 text-xs" />
                  {ingredientes.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(idx)}><X className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              ))}
            </div>

            {formCosto > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm font-semibold flex justify-between">
                <span>Costo estimado de la receta:</span>
                <span className="text-primary">{formatMoney(formCosto)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar receta?</DialogTitle>
            <DialogDescription>La receta se desactivará.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (deleteTarget) deleteReceta(deleteTarget); setDeleteTarget(null); toast.success("Receta eliminada"); }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
