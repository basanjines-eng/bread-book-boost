import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, today } from "@/lib/accounting";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, CalendarDays, BookOpen, Lock, RefreshCw, PackagePlus } from "lucide-react";

interface IngredienteLine {
  insumo_id: string;
  cantidad_usada: string;
  unidad_medida: string;
  cantidad_original?: string; // para mostrar si cambió
}

export default function RecetasPage() {
  const {
    recetas, productos, insumos, getProducto, getInsumo, getStockForInsumo,
    addReceta, updateReceta, deleteReceta, getRecetaInsumos, calcularCostoReceta, addProducto,
  } = useAccounting();

  const [showForm, setShowForm] = useState(false);
  const [formTipo, setFormTipo] = useState<'estandar' | 'dia'>('estandar');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formProductoId, setFormProductoId] = useState("");
  const [formFecha, setFormFecha] = useState(today());
  const [ingredientes, setIngredientes] = useState<IngredienteLine[]>([{ insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showNewProducto, setShowNewProducto] = useState(false);
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState("");
  const [pendingProductoName, setPendingProductoName] = useState<string | null>(null);

  // Auto-select newly created product once it appears in the list
  React.useEffect(() => {
    if (pendingProductoName) {
      const found = productos.find(p => p.nombre.toLowerCase() === pendingProductoName.toLowerCase() && p.activo);
      if (found) {
        setFormProductoId(found.id);
        setPendingProductoName(null);
      }
    }
  }, [productos, pendingProductoName]);

  const handleCrearProducto = () => {
    const nombre = nuevoProductoNombre.trim();
    if (!nombre) { toast.error("Ingresá un nombre para el producto"); return; }
    if (productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase() && p.activo)) {
      toast.error("Ya existe un producto con ese nombre"); return;
    }
    addProducto(nombre);
    toast.success(`Producto "${nombre}" creado`);
    setPendingProductoName(nombre);
    setNuevoProductoNombre("");
    setShowNewProducto(false);
  };

  const recetasEstandar = recetas.filter(r => !r.deleted_at && r.activo && !r.fecha_especifica);
  const recetasDia = recetas.filter(r => !r.deleted_at && r.fecha_especifica).sort((a, b) =>
    (b.fecha_especifica || "").localeCompare(a.fecha_especifica || "")
  );

  const resetForm = () => {
    setEditingId(null);
    setFormNombre(""); setFormProductoId(""); setFormFecha(today());
    setIngredientes([{ insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
    setShowForm(false);
  };

  // Cuando se elige un producto en el form de "día", carga la receta estándar de ese producto
  const cargarRecetaEstandar = (productoId: string) => {
    const recetaBase = recetasEstandar.find(r => r.producto_id === productoId);
    if (recetaBase) {
      const ings = getRecetaInsumos(recetaBase.id);
      if (ings.length > 0) {
        setIngredientes(ings.map(i => ({
          insumo_id: i.insumo_id,
          cantidad_usada: String(i.cantidad_usada),
          unidad_medida: i.unidad_medida,
          cantidad_original: String(i.cantidad_usada),
        })));
        setFormNombre(`${recetaBase.nombre_receta} — variación ${formFecha}`);
        return true;
      }
    }
    return false;
  };

  const handleProductoChange = (productoId: string) => {
    setFormProductoId(productoId);
    if (formTipo === 'dia') {
      cargarRecetaEstandar(productoId);
    }
  };

  const openFormEstandar = () => {
    setFormTipo('estandar');
    resetForm();
    setShowForm(true);
  };

  const openFormDia = () => {
    setFormTipo('dia');
    resetForm();
    setShowForm(true);
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
    if (formTipo === 'dia' && !formFecha) { toast.error("La fecha es obligatoria para receta del día"); return; }
    const validIngredientes = ingredientes.filter(l => l.insumo_id && parseFloat(l.cantidad_usada) > 0);
    if (validIngredientes.length === 0) { toast.error("Agregue al menos un ingrediente"); return; }

    const ingData = validIngredientes.map(l => ({
      insumo_id: l.insumo_id,
      cantidad_usada: parseFloat(l.cantidad_usada),
      unidad_medida: l.unidad_medida,
    }));

    if (editingId) {
      updateReceta(editingId, { nombre_receta: formNombre, producto_id: formProductoId }, ingData);
      toast.success("Receta actualizada — costos recalculados automáticamente");
    } else {
      addReceta({
        nombre_receta: formNombre,
        producto_id: formProductoId,
        activo: true,
        fecha_especifica: formTipo === 'dia' ? formFecha : null,
      }, ingData);
      toast.success(formTipo === 'dia'
        ? `Receta del día ${formFecha} guardada como registro histórico`
        : "Receta estándar creada"
      );
    }
    resetForm();
  };

  const handleEdit = (id: string) => {
    const r = recetas.find(x => x.id === id);
    if (!r) return;
    if (r.fecha_especifica) {
      toast.error("Las recetas del día no se pueden editar — son un registro histórico");
      return;
    }
    const ings = getRecetaInsumos(id);
    setEditingId(id);
    setFormTipo('estandar');
    setFormNombre(r.nombre_receta);
    setFormProductoId(r.producto_id);
    setIngredientes(ings.length > 0 ? ings.map(i => ({
      insumo_id: i.insumo_id,
      cantidad_usada: String(i.cantidad_usada),
      unidad_medida: i.unidad_medida,
    })) : [{ insumo_id: "", cantidad_usada: "", unidad_medida: "" }]);
    setShowForm(true);
  };

  const formCosto = ingredientes.reduce((total, l) => {
    if (!l.insumo_id || !l.cantidad_usada) return total;
    const stk = getStockForInsumo(l.insumo_id);
    return total + (parseFloat(l.cantidad_usada) || 0) * (stk?.costo_promedio || 0);
  }, 0);

  const activeInsumos = insumos.filter(i => i.activo && !i.deleted_at);

  // Contar cuántos ingredientes cambiaron respecto a la original
  const cantidadesCambiadas = ingredientes.filter(l =>
    l.cantidad_original && l.cantidad_usada !== l.cantidad_original
  ).length;

  const RecetaCard = ({ r, esDia = false }: { r: typeof recetas[0], esDia?: boolean }) => {
    const prod = getProducto(r.producto_id);
    const ings = getRecetaInsumos(r.id);
    const costo = calcularCostoReceta(r.id);
    const costosPorIngrediente = ings.map(ing => {
      const ins = getInsumo(ing.insumo_id);
      const stk = getStockForInsumo(ing.insumo_id);
      const cpp = stk?.costo_promedio || 0;
      const costoIng = ing.cantidad_usada * cpp;
      return { ing, ins, cpp, costoIng };
    });

    // Para recetas del día, obtener la receta estándar del mismo producto para comparar
    const recetaBase = esDia ? recetasEstandar.find(re => re.producto_id === r.producto_id) : null;
    const ingsBase = recetaBase ? getRecetaInsumos(recetaBase.id) : [];

    return (
      <Card className={esDia ? "border-amber-200 bg-amber-50/30" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="font-display flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              {esDia ? <CalendarDays className="h-4 w-4 text-amber-500" /> : <BookOpen className="h-4 w-4 text-primary" />}
              <span className="text-base">{r.nombre_receta}</span>
            </div>
            <div className="flex gap-1 items-center">
              {esDia ? (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Solo lectura
                </Badge>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(r.id)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r.id)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </>
              )}
            </div>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{prod?.nombre || '-'}</Badge>
            {esDia && r.fecha_especifica && (
              <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100">
                📅 {r.fecha_especifica}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs text-muted-foreground mb-1 px-1">
              <span>Ingrediente</span>
              <span className="text-right">CPP</span>
              <span className="text-right">Subtotal</span>
            </div>
            {costosPorIngrediente.map(({ ing, ins, cpp, costoIng }) => {
              // Comparar con receta base si es del día
              const ingBase = ingsBase.find(ib => ib.insumo_id === ing.insumo_id);
              const cambio = ingBase && ingBase.cantidad_usada !== ing.cantidad_usada;
              const subio = ingBase && ing.cantidad_usada > ingBase.cantidad_usada;
              return (
                <div key={ing.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-sm items-center">
                  <span className={`truncate ${cambio ? (subio ? "text-red-600 font-medium" : "text-green-600 font-medium") : ""}`}>
                    {ins?.nombre || '-'} ({ing.cantidad_usada} {ing.unidad_medida})
                    {cambio && ingBase && (
                      <span className="text-xs ml-1 opacity-70">
                        (antes: {ingBase.cantidad_usada})
                      </span>
                    )}
                  </span>
                  <span className="text-right text-muted-foreground text-xs whitespace-nowrap">{formatMoney(cpp)}/{ing.unidad_medida}</span>
                  <span className="text-right font-medium whitespace-nowrap">{formatMoney(costoIng)}</span>
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Recetas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openFormDia}>
            <CalendarDays className="h-4 w-4 mr-1" /> Receta del Día
          </Button>
          <Button onClick={openFormEstandar}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Receta
          </Button>
        </div>
      </div>

      <Tabs defaultValue="estandar">
        <TabsList>
          <TabsTrigger value="estandar" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Recetas Estándar
            <Badge variant="secondary" className="text-xs">{recetasEstandar.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="dia" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Historial del Día
            <Badge variant="secondary" className="text-xs">{recetasDia.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estandar" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recetasEstandar.map(r => <RecetaCard key={r.id} r={r} />)}
            {recetasEstandar.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay recetas estándar. Creá tu primera receta con "Nueva Receta".
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dia" className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Registro histórico de variaciones diarias. Los ingredientes en <span className="text-green-600 font-medium">verde</span> bajaron y en <span className="text-red-600 font-medium">rojo</span> subieron respecto a la receta estándar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recetasDia.map(r => <RecetaCard key={r.id} r={r} esDia />)}
            {recetasDia.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay variaciones del día registradas. Usá "Receta del Día" cuando cambies cantidades puntualmente.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => !v && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formTipo === 'dia'
                ? <><CalendarDays className="h-5 w-5 text-amber-500" />{editingId ? "Editar Receta" : "Nueva Receta del Día"}</>
                : <><BookOpen className="h-5 w-5 text-primary" />{editingId ? "Editar Receta" : "Nueva Receta Estándar"}</>
              }
            </DialogTitle>
            {formTipo === 'dia' && !editingId && (
              <p className="text-sm text-muted-foreground">
                Se carga automáticamente la receta estándar del producto. Solo modificá lo que cambió ese día.
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nombre de la Receta *</Label>
                <Input value={formNombre} onChange={e => setFormNombre(e.target.value)}
                  placeholder={formTipo === 'dia' ? "Se llena automáticamente" : "Ej: Masa Pan"} />
              </div>
              <div>
                <Label>Producto Asociado *</Label>
                <div className="flex gap-2">
                  <Select value={formProductoId} onValueChange={handleProductoChange}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {productos.filter(p => p.activo).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Crear producto nuevo"
                    onClick={() => setShowNewProducto(!showNewProducto)}>
                    <PackagePlus className="h-4 w-4" />
                  </Button>
                </div>
                {showNewProducto && (
                  <div className="mt-2 flex gap-2 items-center p-2 rounded-md border bg-muted/50">
                    <Input
                      value={nuevoProductoNombre}
                      onChange={e => setNuevoProductoNombre(e.target.value)}
                      placeholder="Nombre del nuevo producto"
                      className="flex-1 h-8 text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleCrearProducto()}
                    />
                    <Button type="button" size="sm" className="h-8" onClick={handleCrearProducto}>
                      Crear
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setShowNewProducto(false); setNuevoProductoNombre(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {formTipo === 'dia' && formProductoId && !recetasEstandar.find(r => r.producto_id === formProductoId) && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Este producto no tiene receta estándar — ingresá los ingredientes manualmente.</p>
                )}
              </div>
            </div>

            {formTipo === 'dia' && !editingId && (
              <div>
                <Label>Fecha del Día *</Label>
                <Input type="date" value={formFecha} onChange={e => {
                  setFormFecha(e.target.value);
                  // Actualizar nombre automático si ya tiene producto
                  if (formProductoId) {
                    const recetaBase = recetasEstandar.find(r => r.producto_id === formProductoId);
                    if (recetaBase) setFormNombre(`${recetaBase.nombre_receta} — variación ${e.target.value}`);
                  }
                }} />
                <p className="text-xs text-muted-foreground mt-1">Quedará fijada a este día y no podrá editarse después.</p>
              </div>
            )}

            {/* Ingredientes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">Ingredientes</Label>
                  {formTipo === 'dia' && cantidadesCambiadas > 0 && (
                    <span className="text-xs text-amber-600 ml-2">
                      {cantidadesCambiadas} {cantidadesCambiadas === 1 ? 'ingrediente modificado' : 'ingredientes modificados'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {formTipo === 'dia' && formProductoId && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => cargarRecetaEstandar(formProductoId)} className="h-7 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3 mr-1" /> Restaurar original
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />Agregar
                  </Button>
                </div>
              </div>

              {ingredientes.map((line, idx) => {
                const cambio = line.cantidad_original && line.cantidad_usada !== line.cantidad_original;
                const subio = line.cantidad_original && parseFloat(line.cantidad_usada) > parseFloat(line.cantidad_original);
                return (
                  <div key={idx} className={`flex gap-2 items-start p-1 rounded ${cambio ? (subio ? 'bg-red-50' : 'bg-green-50') : ''}`}>
                    <div className="flex-1">
                      <Select value={line.insumo_id} onValueChange={v => updateLine(idx, 'insumo_id', v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Insumo" /></SelectTrigger>
                        <SelectContent>
                          {activeInsumos.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col items-end">
                      <Input
                        type="number"
                        value={line.cantidad_usada}
                        onChange={e => updateLine(idx, 'cantidad_usada', e.target.value)}
                        placeholder="Cant."
                        className={`w-20 h-9 text-xs ${cambio ? (subio ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700') : ''}`}
                        min="0" step="0.01"
                      />
                      {cambio && line.cantidad_original && (
                        <span className="text-xs text-muted-foreground mt-0.5">orig: {line.cantidad_original}</span>
                      )}
                    </div>
                    <Input value={line.unidad_medida} onChange={e => updateLine(idx, 'unidad_medida', e.target.value)}
                      placeholder="Unid." className="w-24 h-9 text-xs" />
                    {ingredientes.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
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
            <Button variant="destructive" onClick={() => {
              if (deleteTarget) deleteReceta(deleteTarget);
              setDeleteTarget(null);
              toast.success("Receta eliminada");
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
