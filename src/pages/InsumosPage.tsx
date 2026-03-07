import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import { Plus, Trash2, Search, Package, AlertTriangle, TrendingDown, ArrowUpCircle, ArrowDownCircle, Settings2, X } from "lucide-react";
import type { Insumo, CategoriaInsumo, TipoMovimientoInsumo } from "@/types/accounting";

const CATEGORIAS: CategoriaInsumo[] = ['Ingredientes', 'Combustible', 'Empaque', 'Otros ingredientes'];

export default function InsumosPage() {
  const {
    insumos, stockInsumos, movimientosInsumos, getInsumo, getStockForInsumo,
    addInsumo, updateInsumo, deleteInsumo, addMovimientoInsumo, deleteMovimientoInsumo,
  } = useAccounting();

  const [tab, setTab] = useState("inventario");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("activos");

  // Insumo form
  const [showInsumoForm, setShowInsumoForm] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState<CategoriaInsumo>("Ingredientes");
  const [formUnidadBase, setFormUnidadBase] = useState("");
  const [formUnidadCompra, setFormUnidadCompra] = useState("");
  const [formEquivalencia, setFormEquivalencia] = useState("1");
  const [formStockMinimo, setFormStockMinimo] = useState("0");
  const [formStockIdeal, setFormStockIdeal] = useState("0");
  const [formPrecioRef, setFormPrecioRef] = useState("0");
  const [formProveedor, setFormProveedor] = useState("");
  const [formObs, setFormObs] = useState("");

  // Movimiento form
  const [showMovForm, setShowMovForm] = useState(false);
  const [movTipo, setMovTipo] = useState<TipoMovimientoInsumo>("ENTRADA");
  const [movInsumoId, setMovInsumoId] = useState("");
  const [movFecha, setMovFecha] = useState(today());
  const [movFechaCompra, setMovFechaCompra] = useState(today());
  const [movCantidad, setMovCantidad] = useState("");
  const [movUnidad, setMovUnidad] = useState("");
  const [movPrecio, setMovPrecio] = useState("");
  const [movProveedor, setMovProveedor] = useState("");
  const [movReferencia, setMovReferencia] = useState("");
  const [movObs, setMovObs] = useState("");
  const [movMotivo, setMovMotivo] = useState("");
  const [movAjusteTipo, setMovAjusteTipo] = useState<"sube" | "baja">("sube");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activeInsumos = insumos.filter(i => !i.deleted_at && (estadoFilter === 'all' || (estadoFilter === 'activos' && i.activo) || (estadoFilter === 'inactivos' && !i.activo)));
  const filtered = activeInsumos
    .filter(i => catFilter === 'all' || i.categoria === catFilter)
    .filter(i => i.nombre.toLowerCase().includes(search.toLowerCase()));

  const totalValor = stockInsumos.reduce((s, si) => {
    const ins = insumos.find(i => i.id === si.insumo_id && !i.deleted_at);
    return ins ? s + si.valor_actual : s;
  }, 0);
  const criticos = filtered.filter(i => {
    const stk = getStockForInsumo(i.id);
    return stk && i.stock_minimo > 0 && stk.cantidad_actual <= i.stock_minimo;
  });
  const bajos = filtered.filter(i => {
    const stk = getStockForInsumo(i.id);
    return stk && i.stock_ideal > 0 && stk.cantidad_actual <= i.stock_ideal && !criticos.includes(i);
  });

  const resetInsumoForm = () => {
    setEditingInsumo(null);
    setFormNombre(""); setFormCategoria("Ingredientes"); setFormUnidadBase("");
    setFormUnidadCompra(""); setFormEquivalencia("1"); setFormStockMinimo("0");
    setFormStockIdeal("0"); setFormPrecioRef("0"); setFormProveedor(""); setFormObs("");
    setShowInsumoForm(false);
  };

  const handleSaveInsumo = () => {
    if (!formNombre || !formUnidadBase) { toast.error("Nombre y unidad base son obligatorios"); return; }
    if (editingInsumo) {
      updateInsumo({
        ...editingInsumo, nombre: formNombre, categoria: formCategoria,
        unidad_base: formUnidadBase, unidad_compra_habitual: formUnidadCompra || formUnidadBase,
        equivalencia_compra: parseFloat(formEquivalencia) || 1,
        stock_minimo: parseFloat(formStockMinimo) || 0, stock_ideal: parseFloat(formStockIdeal) || 0,
        precio_unitario_referencia: parseFloat(formPrecioRef) || 0,
        proveedor_habitual: formProveedor, observaciones: formObs,
      });
      toast.success("Insumo actualizado");
    } else {
      addInsumo({
        nombre: formNombre, categoria: formCategoria, unidad_base: formUnidadBase,
        unidad_compra_habitual: formUnidadCompra || formUnidadBase,
        equivalencia_compra: parseFloat(formEquivalencia) || 1,
        stock_minimo: parseFloat(formStockMinimo) || 0, stock_ideal: parseFloat(formStockIdeal) || 0,
        precio_unitario_referencia: parseFloat(formPrecioRef) || 0,
        proveedor_habitual: formProveedor, observaciones: formObs, activo: true,
      });
      toast.success("Insumo creado");
    }
    resetInsumoForm();
  };

  const handleEditInsumo = (i: Insumo) => {
    setEditingInsumo(i);
    setFormNombre(i.nombre); setFormCategoria(i.categoria); setFormUnidadBase(i.unidad_base);
    setFormUnidadCompra(i.unidad_compra_habitual); setFormEquivalencia(String(i.equivalencia_compra));
    setFormStockMinimo(String(i.stock_minimo)); setFormStockIdeal(String(i.stock_ideal));
    setFormPrecioRef(String(i.precio_unitario_referencia)); setFormProveedor(i.proveedor_habitual);
    setFormObs(i.observaciones);
    setShowInsumoForm(true);
  };

  const resetMovForm = () => {
    setMovInsumoId(""); setMovCantidad(""); setMovUnidad(""); setMovPrecio("");
    setMovProveedor(""); setMovReferencia(""); setMovObs(""); setMovMotivo("");
    setMovFecha(today()); setMovFechaCompra(today());
    setShowMovForm(false);
  };

  const handleSaveMovimiento = () => {
    if (!movInsumoId || !movCantidad) { toast.error("Insumo y cantidad son obligatorios"); return; }
    const ins = getInsumo(movInsumoId);
    if (!ins) return;
    const cantNum = parseFloat(movCantidad) || 0;
    if (cantNum <= 0) { toast.error("Cantidad debe ser mayor a 0"); return; }

    const isBaseUnit = (movUnidad || ins.unidad_base) === ins.unidad_base;
    const cantBase = isBaseUnit ? cantNum : cantNum * ins.equivalencia_compra;

    let costoTotal = 0;
    let precioUnit = parseFloat(movPrecio) || 0;
    if (movTipo === 'ENTRADA') {
      costoTotal = precioUnit * cantNum;
    }

    const cantEquiv = movTipo === 'AJUSTE' && movAjusteTipo === 'baja' ? -cantBase : cantBase;

    addMovimientoInsumo({
      fecha: movFecha, fecha_compra: movTipo === 'ENTRADA' ? movFechaCompra : undefined,
      insumo_id: movInsumoId, tipo_movimiento: movTipo,
      cantidad: cantNum, unidad_movimiento: movUnidad || ins.unidad_base,
      cantidad_equivalente_base: cantEquiv, precio_unitario: precioUnit,
      costo_total: costoTotal, motivo: movMotivo, proveedor: movProveedor,
      referencia: movReferencia, observacion: movObs,
    });
    toast.success(`Movimiento registrado: ${movTipo}`);
    resetMovForm();
  };

  const openMovForm = (tipo: TipoMovimientoInsumo) => {
    setMovTipo(tipo);
    setShowMovForm(true);
  };

  const getEstadoInsumo = (i: Insumo) => {
    const stk = getStockForInsumo(i.id);
    if (!stk) return 'normal';
    if (i.stock_minimo > 0 && stk.cantidad_actual <= i.stock_minimo) return 'critico';
    if (i.stock_ideal > 0 && stk.cantidad_actual <= i.stock_ideal) return 'bajo';
    return 'suficiente';
  };

  const activeMovimientos = movimientosInsumos.filter(m => !m.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Inventario de Insumos</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Insumos</p>
            <p className="text-2xl font-display font-bold">{activeInsumos.length}</p>
          </CardContent>
        </Card>
        <Card className={criticos.length > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Críticos</p>
            <p className="text-2xl font-display font-bold text-destructive">{criticos.length}</p>
          </CardContent>
        </Card>
        <Card className={bajos.length > 0 ? 'border-warning/50' : ''}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" />Bajos</p>
            <p className="text-2xl font-display font-bold text-warning">{bajos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-display font-bold">{formatMoney(totalValor)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar insumo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activos">Activos</SelectItem>
                <SelectItem value="inactivos">Inactivos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { resetInsumoForm(); setShowInsumoForm(true); }}><Plus className="h-4 w-4 mr-1" />Nuevo Insumo</Button>
            <Button variant="outline" onClick={() => openMovForm('ENTRADA')}><ArrowUpCircle className="h-4 w-4 mr-1" />Entrada</Button>
            <Button variant="outline" onClick={() => openMovForm('SALIDA')}><ArrowDownCircle className="h-4 w-4 mr-1" />Salida</Button>
            <Button variant="outline" onClick={() => openMovForm('AJUSTE')}><Settings2 className="h-4 w-4 mr-1" />Ajuste</Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4">Insumo</th>
                      <th className="text-left py-3 px-2">Categoría</th>
                      <th className="text-left py-3 px-2">Unidad</th>
                      <th className="text-right py-3 px-2">Stock</th>
                      <th className="text-right py-3 px-2">CPP</th>
                      <th className="text-right py-3 px-2">Valor</th>
                      <th className="text-right py-3 px-2">Mín.</th>
                      <th className="text-right py-3 px-2">Ideal</th>
                      <th className="text-center py-3 px-2">Estado</th>
                      <th className="text-center py-3 px-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(i => {
                      const stk = getStockForInsumo(i.id);
                      const estado = getEstadoInsumo(i);
                      const necesidad = i.stock_ideal > 0 && stk ? Math.max(0, i.stock_ideal - stk.cantidad_actual) : 0;
                      return (
                        <tr key={i.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-4 font-medium">{i.nombre}</td>
                          <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{i.categoria}</Badge></td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">{i.unidad_base}<br/><span className="text-[10px]">{i.unidad_compra_habitual} = {i.equivalencia_compra} {i.unidad_base}</span></td>
                          <td className={`text-right py-2 px-2 font-bold ${estado === 'critico' ? 'text-destructive' : estado === 'bajo' ? 'text-warning' : ''}`}>
                            {stk?.cantidad_actual.toFixed(1) || '0'}
                          </td>
                          <td className="text-right py-2 px-2">{formatMoney(stk?.costo_promedio || 0)}</td>
                          <td className="text-right py-2 px-2">{formatMoney(stk?.valor_actual || 0)}</td>
                          <td className="text-right py-2 px-2 text-xs">{i.stock_minimo || '-'}</td>
                          <td className="text-right py-2 px-2 text-xs">{i.stock_ideal || '-'}</td>
                          <td className="text-center py-2 px-2">
                            {estado === 'critico' && <Badge variant="destructive" className="text-[10px]">Crítico</Badge>}
                            {estado === 'bajo' && <Badge className="text-[10px] bg-warning text-warning-foreground">Bajo</Badge>}
                            {estado === 'suficiente' && <Badge variant="outline" className="text-[10px] text-success border-success">OK</Badge>}
                            {necesidad > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Comprar: {necesidad.toFixed(1)}</p>}
                          </td>
                          <td className="text-center py-2 px-2">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleEditInsumo(i)} className="h-7 w-7 p-0">
                                <Settings2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(i.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="text-center text-muted-foreground py-6">Sin insumos</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openMovForm('ENTRADA')}><ArrowUpCircle className="h-4 w-4 mr-1" />Entrada</Button>
            <Button variant="outline" onClick={() => openMovForm('SALIDA')}><ArrowDownCircle className="h-4 w-4 mr-1" />Salida</Button>
            <Button variant="outline" onClick={() => openMovForm('AJUSTE')}><Settings2 className="h-4 w-4 mr-1" />Ajuste</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4">Fecha</th>
                      <th className="text-left py-3 px-2">Insumo</th>
                      <th className="text-center py-3 px-2">Tipo</th>
                      <th className="text-right py-3 px-2">Cantidad</th>
                      <th className="text-left py-3 px-2">Unidad</th>
                      <th className="text-right py-3 px-2">Equiv. Base</th>
                      <th className="text-right py-3 px-2">P. Unit.</th>
                      <th className="text-right py-3 px-2">Total</th>
                      <th className="text-left py-3 px-2">Motivo</th>
                      <th className="text-center py-3 px-2">Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMovimientos.map(m => {
                      const ins = insumos.find(i => i.id === m.insumo_id);
                      return (
                        <tr key={m.id} className="border-b border-border/50">
                          <td className="py-2 px-4">{formatDate(m.fecha)}</td>
                          <td className="py-2 px-2">{ins?.nombre || '-'}</td>
                          <td className="text-center py-2 px-2">
                            <Badge variant={m.tipo_movimiento === 'ENTRADA' ? 'default' : m.tipo_movimiento === 'SALIDA' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {m.tipo_movimiento}
                            </Badge>
                          </td>
                          <td className="text-right py-2 px-2">{m.cantidad}</td>
                          <td className="py-2 px-2 text-xs">{m.unidad_movimiento}</td>
                          <td className="text-right py-2 px-2">{m.cantidad_equivalente_base.toFixed(1)}</td>
                          <td className="text-right py-2 px-2">{m.precio_unitario > 0 ? formatMoney(m.precio_unitario) : '-'}</td>
                          <td className="text-right py-2 px-2">{m.costo_total > 0 ? formatMoney(m.costo_total) : '-'}</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground max-w-[150px] truncate">{m.motivo || m.proveedor || m.referencia || '-'}</td>
                          <td className="text-center py-2 px-2">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                              onClick={() => {
                                const ok = deleteMovimientoInsumo(m.id);
                                if (ok) toast.success("Movimiento eliminado");
                                else toast.error("No se puede eliminar: existen movimientos posteriores");
                              }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {activeMovimientos.length === 0 && <p className="text-center text-muted-foreground py-6">Sin movimientos</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insumo Form Dialog */}
      <Dialog open={showInsumoForm} onOpenChange={v => !v && resetInsumoForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={formNombre} onChange={e => setFormNombre(e.target.value)} /></div>
            <div>
              <Label>Categoría</Label>
              <Select value={formCategoria} onValueChange={v => setFormCategoria(v as CategoriaInsumo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unidad Base *</Label><Input value={formUnidadBase} onChange={e => setFormUnidadBase(e.target.value)} placeholder="kg, unidades..." /></div>
              <div><Label>Unid. Compra</Label><Input value={formUnidadCompra} onChange={e => setFormUnidadCompra(e.target.value)} placeholder="bolsa, maple..." /></div>
            </div>
            <div><Label>Equivalencia (1 compra = X base)</Label><Input type="number" value={formEquivalencia} onChange={e => setFormEquivalencia(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Stock Mínimo</Label><Input type="number" value={formStockMinimo} onChange={e => setFormStockMinimo(e.target.value)} /></div>
              <div><Label>Stock Ideal</Label><Input type="number" value={formStockIdeal} onChange={e => setFormStockIdeal(e.target.value)} /></div>
            </div>
            <div><Label>Precio Referencia</Label><Input type="number" value={formPrecioRef} onChange={e => setFormPrecioRef(e.target.value)} /></div>
            <div><Label>Proveedor Habitual</Label><Input value={formProveedor} onChange={e => setFormProveedor(e.target.value)} /></div>
            <div><Label>Observaciones</Label><Input value={formObs} onChange={e => setFormObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetInsumoForm}>Cancelar</Button>
            <Button onClick={handleSaveInsumo}>{editingInsumo ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movimiento Form Dialog */}
      <Dialog open={showMovForm} onOpenChange={v => !v && resetMovForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar {movTipo === 'ENTRADA' ? 'Entrada / Compra' : movTipo === 'SALIDA' ? 'Salida / Uso' : 'Ajuste'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Fecha</Label><Input type="date" value={movFecha} onChange={e => setMovFecha(e.target.value)} /></div>
            {movTipo === 'ENTRADA' && (
              <div><Label>Fecha de Compra</Label><Input type="date" value={movFechaCompra} onChange={e => setMovFechaCompra(e.target.value)} /></div>
            )}
            <div>
              <Label>Insumo</Label>
              <Select value={movInsumoId} onValueChange={v => {
                setMovInsumoId(v);
                const ins = insumos.find(i => i.id === v);
                if (ins) setMovUnidad(movTipo === 'ENTRADA' ? ins.unidad_compra_habitual : ins.unidad_base);
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo" /></SelectTrigger>
                <SelectContent>
                  {insumos.filter(i => i.activo && !i.deleted_at).map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad</Label><Input type="number" value={movCantidad} onChange={e => setMovCantidad(e.target.value)} min="0" /></div>
              <div>
                <Label>Unidad</Label>
                <Input value={movUnidad} onChange={e => setMovUnidad(e.target.value)} />
                {movInsumoId && (() => {
                  const ins = getInsumo(movInsumoId);
                  if (!ins) return null;
                  const cantNum = parseFloat(movCantidad) || 0;
                  const isBase = movUnidad === ins.unidad_base;
                  const equiv = isBase ? cantNum : cantNum * ins.equivalencia_compra;
                  return cantNum > 0 && !isBase ? <p className="text-xs text-muted-foreground mt-1">= {equiv.toFixed(1)} {ins.unidad_base}</p> : null;
                })()}
              </div>
            </div>
            {movTipo === 'AJUSTE' && (
              <div>
                <Label>Tipo de Ajuste</Label>
                <Select value={movAjusteTipo} onValueChange={v => setMovAjusteTipo(v as 'sube' | 'baja')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sube">Sube (aumentar stock)</SelectItem>
                    <SelectItem value="baja">Baja (disminuir stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {movTipo === 'ENTRADA' && (
              <>
                <div><Label>Precio Unitario (Bs)</Label><Input type="number" value={movPrecio} onChange={e => setMovPrecio(e.target.value)} min="0" /></div>
                <div><Label>Proveedor</Label><Input value={movProveedor} onChange={e => setMovProveedor(e.target.value)} /></div>
              </>
            )}
            {(movTipo === 'SALIDA' || movTipo === 'AJUSTE') && (
              <div><Label>Motivo</Label><Input value={movMotivo} onChange={e => setMovMotivo(e.target.value)} /></div>
            )}
            <div><Label>Referencia</Label><Input value={movReferencia} onChange={e => setMovReferencia(e.target.value)} /></div>
            <div><Label>Observación</Label><Input value={movObs} onChange={e => setMovObs(e.target.value)} /></div>
            {movTipo === 'ENTRADA' && movCantidad && movPrecio && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <strong>Costo Total: </strong>{formatMoney((parseFloat(movCantidad) || 0) * (parseFloat(movPrecio) || 0))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetMovForm}>Cancelar</Button>
            <Button onClick={handleSaveMovimiento}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Insumo Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar insumo?</DialogTitle>
            <DialogDescription>El insumo se desactivará y ocultará de la vista principal. Su historial se mantendrá.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (deleteTarget) deleteInsumo(deleteTarget); setDeleteTarget(null); toast.success("Insumo eliminado"); }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
