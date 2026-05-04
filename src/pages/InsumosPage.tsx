import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import {
  Plus, Trash2, Search, AlertTriangle, TrendingDown,
  ArrowUpCircle, ArrowDownCircle, Settings2, ChevronDown, ChevronUp, Edit2, Check, X
} from "lucide-react";
import type { Insumo, CategoriaInsumo, TipoMovimientoInsumo, MovimientoInsumo } from "@/types/accounting";

const CATEGORIAS: CategoriaInsumo[] = ['Ingredientes', 'Combustible', 'Empaque', 'Otros ingredientes'];

// ── Inline edit row state ────────────────────────────────────────────────────
type EditRow = {
  nombre: string; categoria: CategoriaInsumo; unidad_base: string;
  unidad_compra_habitual: string; equivalencia_compra: string;
  stock_minimo: string; stock_ideal: string;
  precio_unitario_referencia: string; proveedor_habitual: string; observaciones: string;
};

function insumoToEditRow(i: Insumo): EditRow {
  return {
    nombre: i.nombre, categoria: i.categoria, unidad_base: i.unidad_base,
    unidad_compra_habitual: i.unidad_compra_habitual,
    equivalencia_compra: String(i.equivalencia_compra),
    stock_minimo: String(i.stock_minimo), stock_ideal: String(i.stock_ideal),
    precio_unitario_referencia: String(i.precio_unitario_referencia),
    proveedor_habitual: i.proveedor_habitual, observaciones: i.observaciones,
  };
}

export default function InsumosPage() {
  const {
    cuentas, insumos, stockInsumos, movimientosInsumos, getInsumo, getStockForInsumo,
    addInsumo, updateInsumo, deleteInsumo, addMovimientoInsumo, editMovimientoInsumo, deleteMovimientoInsumo,
  } = useAccounting();

  // Inline editing for movimientos
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  type MovEditRow = { fecha: string; cantidad: string; unidad_movimiento: string; precio_unitario: string; proveedor: string; motivo: string; referencia: string; observacion: string; };
  const [editMovRow, setEditMovRow] = useState<MovEditRow | null>(null);

  const startEditMov = (m: MovimientoInsumo) => {
    setEditingMovId(m.id);
    setEditMovRow({
      fecha: m.fecha, cantidad: String(m.cantidad),
      unidad_movimiento: m.unidad_movimiento,
      precio_unitario: String(m.precio_unitario),
      proveedor: m.proveedor || '', motivo: m.motivo || '',
      referencia: m.referencia || '', observacion: m.observacion || '',
    });
  };
  const cancelEditMov = () => { setEditingMovId(null); setEditMovRow(null); };
  const saveEditMov = (m: MovimientoInsumo) => {
    if (!editMovRow) return;
    const ins = getInsumo(m.insumo_id);
    if (!ins) return;
    const cantNum = parseFloat(editMovRow.cantidad) || 0;
    const precioNum = parseFloat(editMovRow.precio_unitario) || 0;
    const isBase = editMovRow.unidad_movimiento === ins.unidad_base;
    const cantBase = isBase ? cantNum : cantNum * ins.equivalencia_compra;
    const cantEquiv = m.tipo_movimiento === 'AJUSTE' && m.cantidad_equivalente_base < 0 ? -cantBase : cantBase;
    const ok = editMovimientoInsumo(m.id, {
      ...m,
      fecha: editMovRow.fecha,
      cantidad: cantNum,
      unidad_movimiento: editMovRow.unidad_movimiento,
      cantidad_equivalente_base: cantEquiv,
      precio_unitario: precioNum,
      costo_total: m.tipo_movimiento === 'ENTRADA' ? precioNum * cantNum : 0,
      proveedor: editMovRow.proveedor,
      motivo: editMovRow.motivo,
      referencia: editMovRow.referencia,
      observacion: editMovRow.observacion,
    });
    if (ok) toast.success("Movimiento actualizado");
    else toast.error("No se puede editar: existen movimientos posteriores");
    setEditingMovId(null); setEditMovRow(null);
  };

  const [tab, setTab] = useState("inventario");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("activos");

  // Expanded rows (detail panel)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Inline editing row
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow | null>(null);

  // New insumo form (top panel)
  const [showNewForm, setShowNewForm] = useState(false);
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
  const [movEsInventarioInicial, setMovEsInventarioInicial] = useState(false);
  const [movCuentaPagoId, setMovCuentaPagoId] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activeInsumos = insumos.filter(i => !i.deleted_at && (
    estadoFilter === 'all' ||
    (estadoFilter === 'activos' && i.activo) ||
    (estadoFilter === 'inactivos' && !i.activo)
  ));
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

  const getEstadoInsumo = (i: Insumo) => {
    const stk = getStockForInsumo(i.id);
    if (!stk) return 'normal';
    if (i.stock_minimo > 0 && stk.cantidad_actual <= i.stock_minimo) return 'critico';
    if (i.stock_ideal > 0 && stk.cantidad_actual <= i.stock_ideal) return 'bajo';
    return 'suficiente';
  };

  // ── New insumo form ─────────────────────────────────────────────────────────
  const resetNewForm = () => {
    setFormNombre(""); setFormCategoria("Ingredientes"); setFormUnidadBase("");
    setFormUnidadCompra(""); setFormEquivalencia("1"); setFormStockMinimo("0");
    setFormStockIdeal("0"); setFormPrecioRef("0"); setFormProveedor(""); setFormObs("");
    setShowNewForm(false);
  };
  const handleCreateInsumo = () => {
    if (!formNombre || !formUnidadBase) { toast.error("Nombre y unidad base son obligatorios"); return; }
    addInsumo({
      nombre: formNombre, categoria: formCategoria, unidad_base: formUnidadBase,
      unidad_compra_habitual: formUnidadCompra || formUnidadBase,
      equivalencia_compra: parseFloat(formEquivalencia) || 1,
      stock_minimo: parseFloat(formStockMinimo) || 0, stock_ideal: parseFloat(formStockIdeal) || 0,
      precio_unitario_referencia: parseFloat(formPrecioRef) || 0,
      proveedor_habitual: formProveedor, observaciones: formObs, activo: true,
    });
    toast.success("Insumo creado");
    resetNewForm();
  };

  // ── Inline edit ──────────────────────────────────────────────────────────────
  const startEdit = (i: Insumo) => {
    setEditingId(i.id);
    setEditRow(insumoToEditRow(i));
    setExpandedId(i.id); // always expand when editing
  };
  const cancelEdit = () => { setEditingId(null); setEditRow(null); };
  const saveEdit = (i: Insumo) => {
    if (!editRow) return;
    if (!editRow.nombre || !editRow.unidad_base) { toast.error("Nombre y unidad base son obligatorios"); return; }
    updateInsumo({
      ...i,
      nombre: editRow.nombre, categoria: editRow.categoria, unidad_base: editRow.unidad_base,
      unidad_compra_habitual: editRow.unidad_compra_habitual || editRow.unidad_base,
      equivalencia_compra: parseFloat(editRow.equivalencia_compra) || 1,
      stock_minimo: parseFloat(editRow.stock_minimo) || 0,
      stock_ideal: parseFloat(editRow.stock_ideal) || 0,
      precio_unitario_referencia: parseFloat(editRow.precio_unitario_referencia) || 0,
      proveedor_habitual: editRow.proveedor_habitual,
      observaciones: editRow.observaciones,
    });
    toast.success("Insumo actualizado");
    setEditingId(null); setEditRow(null);
  };
  const updateField = (field: keyof EditRow, value: string) => {
    setEditRow(prev => prev ? { ...prev, [field]: value } : prev);
  };

  // ── Movimiento form ──────────────────────────────────────────────────────────
  const resetMovForm = () => {
    setMovInsumoId(""); setMovCantidad(""); setMovUnidad(""); setMovPrecio("");
    setMovProveedor(""); setMovReferencia(""); setMovObs(""); setMovMotivo("");
    setMovFecha(today()); setMovFechaCompra(today()); setMovCuentaPagoId("");
    setShowMovForm(false);
    setMovEsInventarioInicial(false);
  };
  const handleSaveMovimiento = () => {
    if (!movInsumoId || !movCantidad) { toast.error("Insumo y cantidad son obligatorios"); return; }
    if (movTipo === 'ENTRADA' && !movCuentaPagoId) { toast.error("Debe seleccionar una cuenta de pago"); return; }
    const ins = getInsumo(movInsumoId);
    if (!ins) return;
    const cantNum = parseFloat(movCantidad) || 0;
    if (cantNum <= 0) { toast.error("Cantidad debe ser mayor a 0"); return; }
    const isBaseUnit = (movUnidad || ins.unidad_base) === ins.unidad_base;
    const cantBase = isBaseUnit ? cantNum : cantNum * ins.equivalencia_compra;
    const precioUnit = parseFloat(movPrecio) || 0;
    if (movTipo === 'ENTRADA' && precioUnit <= 0) { toast.error("El precio unitario debe ser mayor a 0 para entradas"); return; }
    if (movTipo === 'AJUSTE' && movEsInventarioInicial && precioUnit <= 0) { toast.error("El precio unitario debe ser mayor a 0 para inventario inicial"); return; }
    const costoTotal = movTipo === 'ENTRADA' ? precioUnit * cantNum : 0;
    let cantEquiv: number;
    if (movTipo === 'AJUSTE' && movEsInventarioInicial) {
      cantEquiv = cantBase; // inventario inicial: cantidad absoluta
    } else if (movTipo === 'AJUSTE' && movAjusteTipo === 'baja') {
      cantEquiv = -cantBase; // ajuste baja: negativo para restar
    } else {
      cantEquiv = cantBase;
    }
    const motivoFinal = movTipo === 'AJUSTE' && movEsInventarioInicial
      ? '__INVENTARIO_INICIAL__'
      : movMotivo;
    addMovimientoInsumo({
      fecha: movFecha, fecha_compra: movTipo === 'ENTRADA' ? movFechaCompra : undefined,
      insumo_id: movInsumoId, tipo_movimiento: movTipo,
      cantidad: cantNum, unidad_movimiento: movUnidad || ins.unidad_base,
      cantidad_equivalente_base: cantEquiv, precio_unitario: precioUnit,
      costo_total: costoTotal, motivo: motivoFinal, proveedor: movProveedor,
      referencia: movReferencia, observacion: movObs,
    }, movTipo === 'ENTRADA' ? movCuentaPagoId : undefined);
    toast.success(`Movimiento registrado: ${movTipo}`);
    resetMovForm();
  };
  const openMovForm = (tipo: TipoMovimientoInsumo, insumoId?: string) => {
    setMovTipo(tipo);
    if (insumoId) {
      setMovInsumoId(insumoId);
      const ins = getInsumo(insumoId);
      if (ins) {
        setMovUnidad(tipo === 'ENTRADA' ? ins.unidad_compra_habitual : ins.unidad_base);
        // Pre-cargar precio de referencia del insumo
        if (ins.precio_unitario_referencia > 0) {
          setMovPrecio(String(ins.precio_unitario_referencia));
        }
      }
    }
    setShowMovForm(true);
  };

  const activeMovimientos = movimientosInsumos.filter(m => !m.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Movimientos for a specific insumo (for detail panel)
  const getMovimientosForInsumo = (insumoId: string) =>
    activeMovimientos.filter(m => m.insumo_id === insumoId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Inventario de Insumos</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Insumos</p>
          <p className="text-2xl font-display font-bold">{activeInsumos.length}</p>
        </CardContent></Card>
        <Card className={criticos.length > 0 ? 'border-destructive/50' : ''}><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Críticos</p>
          <p className="text-2xl font-display font-bold text-destructive">{criticos.length}</p>
        </CardContent></Card>
        <Card className={bajos.length > 0 ? 'border-warning/50' : ''}><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" />Bajos</p>
          <p className="text-2xl font-display font-bold text-warning">{bajos.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-display font-bold">{formatMoney(totalValor)}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        {/* ══ INVENTARIO TAB ══════════════════════════════════════════ */}
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
            <Button className="group" onClick={() => { resetNewForm(); setShowNewForm(true); }}>
              <Plus className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Nuevo Insumo
            </Button>
            <Button variant="outline" className="group" onClick={() => openMovForm('ENTRADA')}><ArrowUpCircle className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Entrada</Button>
            <Button variant="outline" className="group" onClick={() => openMovForm('SALIDA')}><ArrowDownCircle className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Salida</Button>
            <Button variant="outline" className="group" onClick={() => openMovForm('AJUSTE')}><Settings2 className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Ajuste</Button>
          </div>

          {/* New Insumo inline form */}
          {showNewForm && (
            <div className="rounded-xl border-2 border-primary/40 bg-card shadow-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-primary/10 border-b border-primary/20">
                <h2 className="font-display font-semibold text-primary text-base">➕ Nuevo Insumo</h2>
                <button onClick={resetNewForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Nombre *</Label>
                  <Input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Harina" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Categoría</Label>
                  <Select value={formCategoria} onValueChange={v => setFormCategoria(v as CategoriaInsumo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Unidad Base *</Label>
                  <Input value={formUnidadBase} onChange={e => setFormUnidadBase(e.target.value)} placeholder="kg, unidades..." />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Unidad Compra</Label>
                  <Input value={formUnidadCompra} onChange={e => setFormUnidadCompra(e.target.value)} placeholder="bolsa, maple..." />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Equivalencia (1 compra = X base)</Label>
                  <Input type="number" value={formEquivalencia} onChange={e => setFormEquivalencia(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Stock Mínimo</Label>
                  <Input type="number" value={formStockMinimo} onChange={e => setFormStockMinimo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Stock Ideal</Label>
                  <Input type="number" value={formStockIdeal} onChange={e => setFormStockIdeal(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Precio Referencia</Label>
                  <Input type="number" value={formPrecioRef} onChange={e => setFormPrecioRef(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Proveedor Habitual</Label>
                  <Input value={formProveedor} onChange={e => setFormProveedor(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Observaciones</Label>
                  <Input value={formObs} onChange={e => setFormObs(e.target.value)} />
                </div>
                <div className="col-span-2 md:col-span-4 flex gap-3 pt-1">
                  <Button onClick={handleCreateInsumo} className="flex-1">Crear Insumo</Button>
                  <Button variant="outline" onClick={resetNewForm}>Cancelar</Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Table with expandable rows ── */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-3 w-8"></th>
                      <th className="text-left py-3 px-3">Insumo</th>
                      <th className="text-left py-3 px-2">Categoría</th>
                      <th className="text-left py-3 px-2">Unidad</th>
                      <th className="text-right py-3 px-2">Stock</th>
                      <th className="text-right py-3 px-2">CPP</th>
                      <th className="text-right py-3 px-2">Valor</th>
                      <th className="text-center py-3 px-2">Estado</th>
                      <th className="text-center py-3 px-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(i => {
                      const stk = getStockForInsumo(i.id);
                      const estado = getEstadoInsumo(i);
                      const isExpanded = expandedId === i.id;
                      const isEditing = editingId === i.id;
                      const movs = getMovimientosForInsumo(i.id);

                      return (
                        <>
                          {/* ── Summary row ── */}
                          <tr
                            key={i.id}
                            className={`border-b border-border/50 cursor-pointer transition-colors ${isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
                            onClick={() => {
                              if (isEditing) return;
                              setExpandedId(isExpanded ? null : i.id);
                            }}
                          >
                            <td className="py-2 px-3 text-muted-foreground">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </td>
                            <td className="py-2 px-3 font-medium">{i.nombre}</td>
                            <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{i.categoria}</Badge></td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">
                              {i.unidad_base}<br />
                              <span className="text-[10px]">{i.unidad_compra_habitual} = {i.equivalencia_compra} {i.unidad_base}</span>
                            </td>
                            <td className={`text-right py-2 px-2 font-bold ${estado === 'critico' ? 'text-destructive' : estado === 'bajo' ? 'text-warning' : ''}`}>
                              {stk?.cantidad_actual.toFixed(1) || '0'}
                            </td>
                            <td className="text-right py-2 px-2 font-semibold text-primary">{formatMoney(stk?.costo_promedio || 0)}<span className="block text-[10px] text-muted-foreground font-normal">/{i.unidad_base}</span></td>
                            <td className="text-right py-2 px-2 font-semibold">{formatMoney(stk?.valor_actual || 0)}</td>
                            <td className="text-center py-2 px-2">
                              {estado === 'critico' && <Badge variant="destructive" className="text-[10px]">Crítico</Badge>}
                              {estado === 'bajo' && <Badge className="text-[10px] bg-warning text-warning-foreground">Bajo</Badge>}
                              {estado === 'suficiente' && <Badge variant="outline" className="text-[10px] text-success border-success">OK</Badge>}
                            </td>
                            <td className="text-center py-2 px-2" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(i)} className="group h-7 w-7 p-0" title="Editar">
                                  <Edit2 className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openMovForm('ENTRADA', i.id)} className="group h-7 w-7 p-0" title="Entrada">
                                  <ArrowUpCircle className="h-3.5 w-3.5 text-success transition-transform duration-200 group-hover:scale-110" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(i.id)} className="group h-7 w-7 p-0 text-destructive hover:text-destructive" title="Eliminar">
                                  <Trash2 className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* ── Expanded detail panel ── */}
                          {isExpanded && (
                            <tr key={`${i.id}-detail`}>
                              <td colSpan={9} className="p-0 border-b border-primary/20">
                                <div className="bg-muted/10 border-l-4 border-primary/40 px-6 py-5 space-y-5">

                                  {/* ── Edit mode fields ── */}
                                  {isEditing && editRow ? (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-semibold text-primary text-sm">✏️ Editando: {i.nombre}</h3>
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={() => saveEdit(i)} className="h-7 gap-1">
                                            <Check className="h-3.5 w-3.5" /> Guardar
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 gap-1">
                                            <X className="h-3.5 w-3.5" /> Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="col-span-2">
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Nombre *</Label>
                                          <Input value={editRow.nombre} onChange={e => updateField('nombre', e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Categoría</Label>
                                          <Select value={editRow.categoria} onValueChange={v => updateField('categoria', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Unidad Base *</Label>
                                          <Input value={editRow.unidad_base} onChange={e => updateField('unidad_base', e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Unidad Compra</Label>
                                          <Input value={editRow.unidad_compra_habitual} onChange={e => updateField('unidad_compra_habitual', e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Equivalencia</Label>
                                          <Input type="number" value={editRow.equivalencia_compra} onChange={e => updateField('equivalencia_compra', e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Stock Mínimo</Label>
                                          <Input type="number" value={editRow.stock_minimo} onChange={e => updateField('stock_minimo', e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Stock Ideal</Label>
                                          <Input type="number" value={editRow.stock_ideal} onChange={e => updateField('stock_ideal', e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Precio Referencia (Bs)</Label>
                                          <Input type="number" value={editRow.precio_unitario_referencia} onChange={e => updateField('precio_unitario_referencia', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Proveedor Habitual</Label>
                                          <Input value={editRow.proveedor_habitual} onChange={e => updateField('proveedor_habitual', e.target.value)} />
                                        </div>
                                        <div className="col-span-2">
                                          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Observaciones</Label>
                                          <Input value={editRow.observaciones} onChange={e => updateField('observaciones', e.target.value)} />
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    /* ── Read-only detail fields ── */
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Categoría</p><p className="font-medium">{i.categoria}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Unidad Base</p><p className="font-medium">{i.unidad_base}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Unidad Compra</p><p className="font-medium">{i.unidad_compra_habitual}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Equivalencia</p><p className="font-medium">1 {i.unidad_compra_habitual} = {i.equivalencia_compra} {i.unidad_base}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Stock Mínimo</p><p className="font-medium">{i.stock_minimo || '—'}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Stock Ideal</p><p className="font-medium">{i.stock_ideal || '—'}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Precio Referencia</p><p className="font-medium">{i.precio_unitario_referencia ? formatMoney(i.precio_unitario_referencia) : '—'}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Proveedor</p><p className="font-medium">{i.proveedor_habitual || '—'}</p></div>
                                      {i.observaciones && <div className="col-span-2 md:col-span-4"><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Observaciones</p><p className="font-medium">{i.observaciones}</p></div>}
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">CPP Actual</p><p className="font-medium">{formatMoney(stk?.costo_promedio || 0)}</p></div>
                                      <div><p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Valor en Stock</p><p className="font-medium">{formatMoney(stk?.valor_actual || 0)}</p></div>
                                    </div>
                                  )}

                                  {/* ── Movimientos del insumo ── */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Historial de movimientos ({movs.length})
                                      </h4>
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="outline" className="group h-6 text-xs px-2" onClick={() => openMovForm('ENTRADA', i.id)}>
                                          <ArrowUpCircle className="h-3 w-3 mr-1 transition-transform duration-200 group-hover:scale-110" />Entrada
                                        </Button>
                                        <Button size="sm" variant="outline" className="group h-6 text-xs px-2" onClick={() => openMovForm('SALIDA', i.id)}>
                                          <ArrowDownCircle className="h-3 w-3 mr-1 transition-transform duration-200 group-hover:scale-110" />Salida
                                        </Button>
                                        <Button size="sm" variant="outline" className="group h-6 text-xs px-2" onClick={() => openMovForm('AJUSTE', i.id)}>
                                          <Settings2 className="h-3 w-3 mr-1 transition-transform duration-200 group-hover:scale-110" />Ajuste
                                        </Button>
                                      </div>
                                    </div>

                                    {movs.length === 0 ? (
                                      <p className="text-xs text-muted-foreground italic">Sin movimientos registrados aún.</p>
                                    ) : (
                                      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wide">
                                              <th className="text-left py-2 px-3">Fecha</th>
                                              <th className="text-center py-2 px-2">Tipo</th>
                                              <th className="text-right py-2 px-2">Cantidad</th>
                                              <th className="text-left py-2 px-2">Unidad</th>
                                              <th className="text-right py-2 px-2">Equiv. Base</th>
                                              <th className="text-right py-2 px-2">P. Unit.</th>
                                              <th className="text-right py-2 px-2">Total</th>
                                              <th className="text-left py-2 px-2">Proveedor / Motivo</th>
                                              <th className="text-left py-2 px-2">Referencia</th>
                                              <th className="text-left py-2 px-2">Observación</th>
                                              <th className="py-2 px-2"></th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/40">
                                            {movs.map(m => {
                                              const isEditingMov = editingMovId === m.id;
                                              if (isEditingMov && editMovRow) {
                                                return (
                                                  <tr key={m.id} className="bg-primary/5">
                                                    <td className="py-1.5 px-2">
                                                      <Input type="date" value={editMovRow.fecha} onChange={e => setEditMovRow(r => r ? {...r, fecha: e.target.value} : r)} className="h-7 text-xs w-32" />
                                                    </td>
                                                    <td className="text-center py-1.5 px-2">
                                                      <Badge variant={m.tipo_movimiento === 'ENTRADA' ? 'default' : m.tipo_movimiento === 'SALIDA' ? 'destructive' : 'secondary'} className="text-[10px]">
                                                        {m.tipo_movimiento}
                                                      </Badge>
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                      <Input type="number" value={editMovRow.cantidad} onChange={e => setEditMovRow(r => r ? {...r, cantidad: e.target.value} : r)} className="h-7 text-xs w-20 text-right" />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                      <Input value={editMovRow.unidad_movimiento} onChange={e => setEditMovRow(r => r ? {...r, unidad_movimiento: e.target.value} : r)} className="h-7 text-xs w-20" />
                                                    </td>
                                                    <td className="text-right py-1.5 px-2 text-muted-foreground text-xs">auto</td>
                                                    <td className="py-1.5 px-2">
                                                      <Input type="number" value={editMovRow.precio_unitario} onChange={e => setEditMovRow(r => r ? {...r, precio_unitario: e.target.value} : r)} className="h-7 text-xs w-20 text-right" placeholder="0" />
                                                    </td>
                                                    <td className="text-right py-1.5 px-2 text-xs text-muted-foreground">
                                                      {formatMoney((parseFloat(editMovRow.cantidad)||0)*(parseFloat(editMovRow.precio_unitario)||0))}
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                      <Input value={editMovRow.proveedor || editMovRow.motivo} onChange={e => setEditMovRow(r => r ? {...r, proveedor: e.target.value, motivo: e.target.value} : r)} className="h-7 text-xs w-28" placeholder="Proveedor/Motivo" />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                      <Input value={editMovRow.referencia} onChange={e => setEditMovRow(r => r ? {...r, referencia: e.target.value} : r)} className="h-7 text-xs w-24" placeholder="Ref." />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                      <Input value={editMovRow.observacion} onChange={e => setEditMovRow(r => r ? {...r, observacion: e.target.value} : r)} className="h-7 text-xs w-24" placeholder="Obs." />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                      <div className="flex gap-1">
                                                        <button onClick={() => saveEditMov(m)} className="text-success hover:text-success/80 transition-colors" title="Guardar">
                                                          <Check className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button onClick={cancelEditMov} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancelar">
                                                          <X className="h-3.5 w-3.5" />
                                                        </button>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              }
                                              return (
                                                <tr key={m.id} className="hover:bg-muted/20 transition-colors group">
                                                  <td className="py-2 px-3">{formatDate(m.fecha)}</td>
                                                  <td className="text-center py-2 px-2">
                                                    <Badge variant={m.tipo_movimiento === 'ENTRADA' ? 'default' : m.tipo_movimiento === 'SALIDA' ? 'destructive' : 'secondary'} className="text-[10px]">
                                                      {m.tipo_movimiento}
                                                    </Badge>
                                                  </td>
                                                  <td className="text-right py-2 px-2 font-medium">{m.cantidad}</td>
                                                  <td className="py-2 px-2 text-muted-foreground">{m.unidad_movimiento}</td>
                                                  <td className="text-right py-2 px-2">{m.cantidad_equivalente_base.toFixed(2)}</td>
                                                  <td className="text-right py-2 px-2">{m.precio_unitario > 0 ? formatMoney(m.precio_unitario) : '—'}</td>
                                                  <td className="text-right py-2 px-2 font-medium">{m.costo_total > 0 ? formatMoney(m.costo_total) : '—'}</td>
                                                  <td className="py-2 px-2 text-muted-foreground max-w-[120px] truncate">{m.proveedor || m.motivo || '—'}</td>
                                                  <td className="py-2 px-2 text-muted-foreground">{m.referencia || '—'}</td>
                                                  <td className="py-2 px-2 text-muted-foreground max-w-[100px] truncate">{m.observacion || '—'}</td>
                                                  <td className="py-2 px-2">
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => startEditMov(m)} className="text-muted-foreground hover:text-primary transition-colors" title="Editar">
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          const ok = deleteMovimientoInsumo(m.id);
                                                          if (ok) toast.success("Movimiento eliminado");
                                                          else toast.error("No se puede eliminar: existen movimientos posteriores");
                                                        }}
                                                        className="text-muted-foreground hover:text-destructive transition-colors" title="Eliminar"
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="text-center text-muted-foreground py-6">Sin insumos</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ MOVIMIENTOS TAB ══════════════════════════════════════════ */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" className="group" onClick={() => openMovForm('ENTRADA')}><ArrowUpCircle className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Entrada</Button>
            <Button variant="outline" className="group" onClick={() => openMovForm('SALIDA')}><ArrowDownCircle className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Salida</Button>
            <Button variant="outline" className="group" onClick={() => openMovForm('AJUSTE')}><Settings2 className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />Ajuste</Button>
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
                      <th className="text-left py-3 px-2">Motivo / Proveedor</th>
                      <th className="text-center py-3 px-2">Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMovimientos.map(m => {
                      const ins = insumos.find(i => i.id === m.insumo_id);
                      return (
                        <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2 px-4">{formatDate(m.fecha)}</td>
                          <td className="py-2 px-2 font-medium">{ins?.nombre || '-'}</td>
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
                            <Button size="sm" variant="ghost" className="group h-7 w-7 p-0 text-destructive"
                              onClick={() => {
                                const ok = deleteMovimientoInsumo(m.id);
                                if (ok) toast.success("Movimiento eliminado");
                                else toast.error("No se puede eliminar: existen movimientos posteriores");
                              }}>
                              <Trash2 className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
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

      {/* Movimiento Form Dialog */}
      <Dialog open={showMovForm} onOpenChange={v => !v && resetMovForm()}>
        <DialogContent className="max-w-lg top-[10%] translate-y-0 data-[state=closed]:slide-out-to-top-[5%] data-[state=open]:slide-in-from-top-[5%]">
          <DialogHeader>
            <DialogTitle>Registrar {movTipo === 'ENTRADA' ? 'Entrada / Compra' : movTipo === 'SALIDA' ? 'Salida / Uso' : 'Ajuste'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Fecha</Label><Input type="date" value={movFecha} onChange={e => setMovFecha(e.target.value)} /></div>
            {movTipo === 'ENTRADA' && <div><Label>Fecha de Compra</Label><Input type="date" value={movFechaCompra} onChange={e => setMovFechaCompra(e.target.value)} /></div>}
            <div>
              <Label>Insumo</Label>
              <Select value={movInsumoId} onValueChange={v => {
                setMovInsumoId(v);
                const ins = insumos.find(i => i.id === v);
                if (ins) setMovUnidad(movTipo === 'ENTRADA' ? ins.unidad_compra_habitual : ins.unidad_base);
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo" /></SelectTrigger>
                <SelectContent>{insumos.filter(i => i.activo && !i.deleted_at).map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}</SelectContent>
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
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <input
                    type="checkbox"
                    id="chk-inv-inicial"
                    checked={movEsInventarioInicial}
                    onChange={e => setMovEsInventarioInicial(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div>
                    <label htmlFor="chk-inv-inicial" className="font-medium text-sm cursor-pointer">
                      Inventario Inicial
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Establece el stock de arranque. Requiere precio unitario. No genera asiento contable.
                    </p>
                  </div>
                </div>
                {!movEsInventarioInicial && (
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
                {movEsInventarioInicial && (
                  <div>
                    <Label>Precio Unitario en {movInsumoId ? getInsumo(movInsumoId)?.unidad_base : 'unidad base'} (Bs)</Label>
                    <Input type="number" value={movPrecio} onChange={e => setMovPrecio(e.target.value)} min="0" />
                    <p className="text-xs text-muted-foreground mt-1">Costo promedio con el que entrará al inventario</p>
                  </div>
                )}
              </div>
            )}
            {movTipo === 'ENTRADA' && (
              <>
                <div><Label>Precio Unitario (Bs)</Label><Input type="number" value={movPrecio} onChange={e => setMovPrecio(e.target.value)} min="0" /></div>
                <div><Label>Proveedor</Label><Input value={movProveedor} onChange={e => setMovProveedor(e.target.value)} /></div>
                <div>
                  <Label>Cuenta de Pago *</Label>
                  <Select value={movCuentaPagoId} onValueChange={setMovCuentaPagoId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                    <SelectContent>
                      {cuentas.filter(c => c.activa && (c.es_caja_banco || c.codigo === 'P1.1')).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {(movTipo === 'SALIDA' || movTipo === 'AJUSTE') && <div><Label>Motivo</Label><Input value={movMotivo} onChange={e => setMovMotivo(e.target.value)} /></div>}
            <div><Label>Referencia</Label><Input value={movReferencia} onChange={e => setMovReferencia(e.target.value)} /></div>
            <div><Label>Observación</Label><Input value={movObs} onChange={e => setMovObs(e.target.value)} /></div>
            {movTipo === 'ENTRADA' && movCantidad && movPrecio && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <strong>Costo Total: </strong>{formatMoney((parseFloat(movCantidad) || 0) * (parseFloat(movPrecio) || 0))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={resetMovForm} className="w-full">Cancelar</Button>
            <Button onClick={handleSaveMovimiento} className="w-full">Registrar</Button>
          </div>
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
            <Button variant="destructive" onClick={() => {
              if (deleteTarget) deleteInsumo(deleteTarget);
              setDeleteTarget(null);
              toast.success("Insumo eliminado");
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
