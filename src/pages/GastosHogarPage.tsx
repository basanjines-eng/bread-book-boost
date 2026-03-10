import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import {
  Plus, Trash2, Search, Edit2, Check, X, Home, Utensils,
  Zap, Car, CreditCard, TrendingUp, ChevronDown, ChevronUp
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
export type CategoriaGasto =
  | 'Comida'
  | 'Servicios Básicos'
  | 'Alquiler'
  | 'Deuda'
  | 'Movilidad';

export type EstadoGasto = 'PENDIENTE' | 'PAGADO';

export interface GastoHogar {
  id: string;
  fecha: string;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;
  estado: EstadoGasto;
  observacion: string;
  created_at: string;
  updated_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIAS: CategoriaGasto[] = [
  'Comida',
  'Servicios Básicos',
  'Alquiler',
  'Deuda',
  'Movilidad',
];

const CATEGORIA_CONFIG: Record<CategoriaGasto, { icon: React.ElementType; color: string; bg: string }> = {
  'Comida':            { icon: Utensils,    color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
  'Servicios Básicos': { icon: Zap,         color: 'text-yellow-600',  bg: 'bg-yellow-50 border-yellow-200' },
  'Alquiler':          { icon: Home,        color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  'Deuda':             { icon: CreditCard,  color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  'Movilidad':         { icon: Car,         color: 'text-green-600',   bg: 'bg-green-50 border-green-200' },
};

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function GastosHogarPage() {
  const STORAGE_KEY = 'gastos_hogar_v1';

  // Load persisted gastos
  const loadGastos = (): GastoHogar[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [gastos, setGastos] = useState<GastoHogar[]>(loadGastos);

  const saveGastos = (list: GastoHogar[]) => {
    setGastos(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  // ── Tabs & Filters ────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'gastos' | 'resumen'>('gastos');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [mesFilter, setMesFilter] = useState<string>('all');

  // ── New / Edit form ───────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFecha, setFormFecha] = useState(today());
  const [formCategoria, setFormCategoria] = useState<CategoriaGasto>('Comida');
  const [formDesc, setFormDesc] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formEstado, setFormEstado] = useState<EstadoGasto>('PENDIENTE');
  const [formObs, setFormObs] = useState('');

  // ── Delete dialog ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Expand rows ───────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  const mesesDisponibles = Array.from(
    new Set(gastos.map(g => g.fecha.slice(0, 7)))
  ).sort().reverse();

  const filtered = gastos.filter(g => {
    const matchCat = catFilter === 'all' || g.categoria === catFilter;
    const matchEstado = estadoFilter === 'all' || g.estado === estadoFilter;
    const matchMes = mesFilter === 'all' || g.fecha.startsWith(mesFilter);
    const matchSearch = g.descripcion.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchEstado && matchMes && matchSearch;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const totalFiltrado = filtered.reduce((s, g) => s + g.monto, 0);
  const totalPendiente = filtered.filter(g => g.estado === 'PENDIENTE').reduce((s, g) => s + g.monto, 0);
  const totalPagado = filtered.filter(g => g.estado === 'PAGADO').reduce((s, g) => s + g.monto, 0);

  // Resumen por categoría
  const resumenPorCategoria = CATEGORIAS.map(cat => {
    const lista = gastos.filter(g => g.categoria === cat &&
      (mesFilter === 'all' || g.fecha.startsWith(mesFilter))
    );
    return {
      categoria: cat,
      total: lista.reduce((s, g) => s + g.monto, 0),
      count: lista.length,
      pagado: lista.filter(g => g.estado === 'PAGADO').reduce((s, g) => s + g.monto, 0),
      pendiente: lista.filter(g => g.estado === 'PENDIENTE').reduce((s, g) => s + g.monto, 0),
    };
  });

  const totalMes = resumenPorCategoria.reduce((s, r) => s + r.total, 0);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setShowForm(false); setEditingId(null);
    setFormFecha(today()); setFormCategoria('Comida'); setFormDesc('');
    setFormMonto(''); setFormEstado('PENDIENTE'); setFormObs('');
  };

  const openNewForm = () => { resetForm(); setShowForm(true); };

  const openEditForm = (g: GastoHogar) => {
    setEditingId(g.id);
    setFormFecha(g.fecha); setFormCategoria(g.categoria); setFormDesc(g.descripcion);
    setFormMonto(String(g.monto)); setFormEstado(g.estado); setFormObs(g.observacion);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formDesc.trim()) { toast.error('La descripción es obligatoria'); return; }
    const montoNum = parseFloat(formMonto);
    if (!formMonto || isNaN(montoNum) || montoNum <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    const now = new Date().toISOString();
    if (editingId) {
      saveGastos(gastos.map(g => g.id === editingId
        ? { ...g, fecha: formFecha, categoria: formCategoria, descripcion: formDesc.trim(), monto: montoNum, estado: formEstado, observacion: formObs, updated_at: now }
        : g
      ));
      toast.success('Gasto actualizado');
    } else {
      const nuevo: GastoHogar = {
        id: genId(), fecha: formFecha, categoria: formCategoria,
        descripcion: formDesc.trim(), monto: montoNum, estado: formEstado,
        observacion: formObs, created_at: now, updated_at: now,
      };
      saveGastos([...gastos, nuevo]);
      toast.success('Gasto registrado');
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    saveGastos(gastos.filter(g => g.id !== id));
    setDeleteTarget(null);
    toast.success('Gasto eliminado');
  };

  const toggleEstado = (g: GastoHogar) => {
    const nuevo: EstadoGasto = g.estado === 'PENDIENTE' ? 'PAGADO' : 'PENDIENTE';
    saveGastos(gastos.map(x => x.id === g.id ? { ...x, estado: nuevo, updated_at: new Date().toISOString() } : x));
    toast.success(`Marcado como ${nuevo}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Gastos del Hogar</h1>
        <Button className="group" onClick={openNewForm}>
          <Plus className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Gastos</p>
          <p className="text-2xl font-display font-bold">{gastos.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total {mesFilter !== 'all' ? mesFilter : 'registrado'}</p>
          <p className="text-2xl font-display font-bold">{formatMoney(totalMes)}</p>
        </CardContent></Card>
        <Card className="border-yellow-300"><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Pendiente</p>
          <p className="text-2xl font-display font-bold text-yellow-600">{formatMoney(totalPendiente)}</p>
        </CardContent></Card>
        <Card className="border-green-300"><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Pagado</p>
          <p className="text-2xl font-display font-bold text-green-600">{formatMoney(totalPagado)}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'gastos' | 'resumen')}>
        <TabsList>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="resumen">Resumen por Categoría</TabsTrigger>
        </TabsList>

        {/* ══ GASTOS TAB ══════════════════════════════════════════════════ */}
        <TabsContent value="gastos" className="space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descripción..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
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
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="PAGADO">Pagado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mesFilter} onValueChange={setMesFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {mesesDisponibles.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Filtrado total */}
          {filtered.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {filtered.length} resultado(s) — Total: <span className="font-semibold text-foreground">{formatMoney(totalFiltrado)}</span>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-3 w-8"></th>
                      <th className="text-left py-3 px-3">Fecha</th>
                      <th className="text-left py-3 px-3">Categoría</th>
                      <th className="text-left py-3 px-3">Descripción</th>
                      <th className="text-right py-3 px-3">Monto</th>
                      <th className="text-center py-3 px-3">Estado</th>
                      <th className="text-center py-3 px-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(g => {
                      const cfg = CATEGORIA_CONFIG[g.categoria];
                      const IconComp = cfg.icon;
                      const isExpanded = expandedId === g.id;
                      return (
                        <>
                          <tr
                            key={g.id}
                            className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : g.id)}
                          >
                            <td className="py-2 px-3 text-muted-foreground">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">{formatDate(g.fecha)}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                                <IconComp className="h-3 w-3" />
                                {g.categoria}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-medium">{g.descripcion}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoney(g.monto)}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={e => { e.stopPropagation(); toggleEstado(g); }}
                                title="Cambiar estado"
                              >
                                <Badge
                                  variant={g.estado === 'PAGADO' ? 'default' : 'secondary'}
                                  className={`text-[10px] cursor-pointer ${g.estado === 'PAGADO' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}
                                >
                                  {g.estado}
                                </Badge>
                              </button>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditForm(g)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget(g.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row */}
                          {isExpanded && (
                            <tr key={`${g.id}-detail`} className="bg-muted/10">
                              <td colSpan={7} className="px-6 py-3">
                                <div className="text-sm space-y-1">
                                  {g.observacion && (
                                    <p><span className="text-muted-foreground">Observación:</span> {g.observacion}</p>
                                  )}
                                  <p className="text-muted-foreground text-xs">
                                    Registrado: {new Date(g.created_at).toLocaleString('es-BO')}
                                    {g.updated_at !== g.created_at && ` · Actualizado: ${new Date(g.updated_at).toLocaleString('es-BO')}`}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="text-center text-muted-foreground py-10">
                    {gastos.length === 0 ? 'Aún no hay gastos registrados. ¡Agrega el primero!' : 'Sin resultados para los filtros seleccionados.'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ RESUMEN TAB ════════════════════════════════════════════════ */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Label className="text-sm text-muted-foreground">Filtrar por mes:</Label>
            <Select value={mesFilter} onValueChange={setMesFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos los meses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {mesesDisponibles.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {resumenPorCategoria.map(r => {
              const cfg = CATEGORIA_CONFIG[r.categoria];
              const IconComp = cfg.icon;
              const pct = totalMes > 0 ? (r.total / totalMes) * 100 : 0;
              return (
                <Card key={r.categoria} className={`border ${cfg.bg}`}>
                  <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-2 rounded-lg ${cfg.bg} border ${cfg.color}`}>
                        <IconComp className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold">{r.categoria}</p>
                        <p className="text-xs text-muted-foreground">{r.count} gasto{r.count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className={`text-lg font-display font-bold ${cfg.color}`}>{formatMoney(r.total)}</p>
                        <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% del total</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500`}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cfg.color.replace('text-', '').includes('orange') ? '#ea580c'
                            : cfg.color.includes('yellow') ? '#ca8a04'
                            : cfg.color.includes('blue') ? '#2563eb'
                            : cfg.color.includes('red') ? '#dc2626'
                            : '#16a34a'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                      <span>Pagado: <span className="text-green-600 font-medium">{formatMoney(r.pagado)}</span></span>
                      <span>Pendiente: <span className="text-yellow-600 font-medium">{formatMoney(r.pendiente)}</span></span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Total row */}
          <Card>
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Total {mesFilter !== 'all' ? mesFilter : 'acumulado'}</span>
                <span className="ml-auto text-xl font-display font-bold">{formatMoney(totalMes)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── New / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={v => !v && resetForm()}>
        <DialogContent className="max-w-md top-[10%] translate-y-0 data-[state=closed]:slide-out-to-top-[5%] data-[state=open]:slide-in-from-top-[5%]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={formCategoria} onValueChange={v => setFormCategoria(v as CategoriaGasto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => {
                    const cfg = CATEGORIA_CONFIG[c];
                    const Ic = cfg.icon;
                    return (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <Ic className={`h-3.5 w-3.5 ${cfg.color}`} />
                          {c}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción *</Label>
              <Input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Ej: Supermercado, Factura de luz..."
              />
            </div>
            <div>
              <Label>Monto (Bs) *</Label>
              <Input
                type="number"
                value={formMonto}
                onChange={e => setFormMonto(e.target.value)}
                min="0"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={formEstado} onValueChange={v => setFormEstado(v as EstadoGasto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="PAGADO">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observación</Label>
              <Input
                value={formObs}
                onChange={e => setFormObs(e.target.value)}
                placeholder="Nota adicional (opcional)"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={resetForm} className="w-full">
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
            <Button onClick={handleSave} className="w-full">
              <Check className="h-4 w-4 mr-1" />{editingId ? 'Actualizar' : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar gasto?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
