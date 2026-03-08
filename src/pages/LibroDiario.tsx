import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { Plus, Trash2, Edit, Check, ChevronDown, ChevronUp, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { TipoCuenta } from "@/types/accounting";

// ─── Helper: derive effect badge for a cuenta + side (debe/haber) ───────────
// Returns e.g. { label: "A＋", color: "green" } — what this entry does to the account
function getEffectBadge(tipo: TipoCuenta, debe: number, haber: number) {
  // Deudora nature (ACTIVO, GASTO): debe=↑, haber=↓
  // Acreedora nature (PASIVO, PATRIMONIO, INGRESO): haber=↑, debe=↓
  const isDeudora = tipo === "ACTIVO" || tipo === "GASTO";
  const amount = debe > 0 ? debe : haber;
  const side = debe > 0 ? "debe" : "haber";
  const increases = isDeudora ? side === "debe" : side === "haber";

  const prefixes: Record<TipoCuenta, string> = {
    ACTIVO: "A",
    PASIVO: "P",
    PATRIMONIO: "C",
    INGRESO: "I",
    GASTO: "G",
  };

  const prefix = prefixes[tipo];
  const sign = increases ? "＋" : "－";

  const colorMap = {
    up: {
      ACTIVO: "bg-transparent text-emerald-600 border-transparent",
      PASIVO: "bg-transparent text-orange-600 border-transparent",
      PATRIMONIO: "bg-transparent text-violet-600 border-transparent",
      INGRESO: "bg-transparent text-blue-600 border-transparent",
      GASTO: "bg-transparent text-rose-600 border-transparent",
    },
    down: {
      ACTIVO: "bg-transparent text-rose-600 border-transparent",
      PASIVO: "bg-transparent text-emerald-600 border-transparent",
      PATRIMONIO: "bg-transparent text-rose-600 border-transparent",
      INGRESO: "bg-transparent text-rose-600 border-transparent",
      GASTO: "bg-transparent text-emerald-600 border-transparent",
    },
  };

  const colors = increases ? colorMap.up[tipo] : colorMap.down[tipo];

  return { label: `${prefix}${sign}`, colors };
}

// ─── Label for tipo de cuenta ────────────────────────────────────────────────
const TIPO_LABELS: Record<TipoCuenta, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
  INGRESO: "Ingreso",
  GASTO: "Gasto",
};

export default function LibroDiario() {
  const {
    comprobantes, cuentas, addComprobante, updateComprobante,
    deleteComprobante, contabilizar, pasarABorrador,
    getDetallesForComprobante, isMesCerrado, getCuenta,
  } = useAccounting();

  // Form is ALWAYS shown — no toggle button
  const [editId, setEditId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(today());
  const [glosa, setGlosa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [lineas, setLineas] = useState<{ cuenta_id: string; descripcion: string; debe: number; haber: number }[]>([
    { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
    { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
  ]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(comprobantes.map(c => c.id)));
  useEffect(() => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      comprobantes.forEach(c => next.add(c.id));
      return next;
    });
  }, [comprobantes]);
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

  const activos = comprobantes.filter(c => !c.deleted_at);
  const filtered = [...activos]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .filter(c => filtroEstado === "TODOS" || c.estado === filtroEstado);

  const addLinea = () => setLineas([...lineas, { cuenta_id: "", descripcion: "", debe: 0, haber: 0 }]);
  const removeLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: string, value: any) =>
    setLineas(lineas.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const totalDebe = lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);
  const balanced = Math.abs(totalDebe - totalHaber) < 0.01;

  const resetForm = () => {
    setFecha(today()); setGlosa(""); setReferencia("");
    setLineas([
      { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
      { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
    ]);
    setEditId(null);
  };

  const handleSave = () => {
    if (!glosa) { toast.error("La glosa es obligatoria"); return; }
    if (lineas.some(l => !l.cuenta_id)) { toast.error("Seleccione cuenta en todas las líneas"); return; }
    if (isMesCerrado(fecha)) { toast.error("El mes está cerrado"); return; }

    const dets = lineas.map(l => ({
      cuenta_id: l.cuenta_id,
      descripcion: l.descripcion,
      debe: Number(l.debe) || 0,
      haber: Number(l.haber) || 0,
    }));

    if (editId) {
      const comp = comprobantes.find(c => c.id === editId)!;
      updateComprobante({ ...comp, fecha, glosa, referencia, estado: "BORRADOR" }, dets);
      toast.success("Comprobante actualizado");
      setExpandedIds(prev => new Set([...prev, editId]));
    } else {
      const newId = addComprobante({ fecha, glosa, referencia, estado: "BORRADOR" }, dets);
      toast.success("Comprobante creado");
      setExpandedIds(prev => new Set([...prev, newId]));
    }
    resetForm();
  };

  const handleContabilizar = (id: string) => {
    const comp = comprobantes.find(c => c.id === id);
    if (comp && isMesCerrado(comp.fecha)) { toast.error("El mes está cerrado"); return; }
    if (contabilizar(id)) {
      toast.success("Comprobante contabilizado");
    } else {
      toast.error("Error: Debe = Haber y al menos una línea");
    }
  };

  const handleEdit = (id: string) => {
    const comp = comprobantes.find(c => c.id === id)!;
    if (comp.estado === "CONTABILIZADO") {
      pasarABorrador(id);
      toast.info("Comprobante pasado a BORRADOR para edición");
    }
    const dets = getDetallesForComprobante(id);
    setFecha(comp.fecha);
    setGlosa(comp.glosa);
    setReferencia(comp.referencia || "");
    setLineas(dets.map(d => ({ cuenta_id: d.cuenta_id, descripcion: d.descripcion, debe: d.debe, haber: d.haber })));
    setEditId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const cuentasActivas = cuentas.filter(c => c.activa);

  return (
    <div className="space-y-6">

      {/* ══════════════════════════════════════════════
          FORMULARIO — siempre visible en la parte superior
      ══════════════════════════════════════════════ */}
      <div className="rounded-xl border-2 border-primary/40 bg-card shadow-md overflow-hidden">
        {/* Form header */}
        <div className="flex items-center justify-between px-5 py-3 bg-primary/10 border-b border-primary/20">
          <h1 className="font-display font-bold text-primary text-xl">
            {editId ? "✏️  Editar Comprobante" : "Libro Diario — Nuevo Comprobante"}
          </h1>
          {editId && (
            <button onClick={resetForm} title="Cancelar edición"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2 py-1">
              <X className="h-3.5 w-3.5" /> Cancelar edición
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Fecha / Referencia / Glosa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Referencia</Label>
              <Input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Glosa *</Label>
              <Input value={glosa} onChange={e => setGlosa(e.target.value)} placeholder="Descripción del comprobante" />
            </div>
          </div>

          {/* Lines table */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">Detalle</Label>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="col-span-4">Cuenta</div>
                <div className="col-span-3">Descripción</div>
                <div className="col-span-2 text-right">Debe</div>
                <div className="col-span-2 text-right">Haber</div>
                <div className="col-span-1 text-center">Efecto</div>
              </div>

              {/* Lines */}
              <div className="divide-y divide-border/50">
                {lineas.map((l, i) => {
                  const cuenta = l.cuenta_id ? getCuenta(l.cuenta_id) : null;
                  const hasAmount = (Number(l.debe) > 0 || Number(l.haber) > 0);
                  const badge = cuenta && hasAmount
                    ? getEffectBadge(cuenta.tipo, Number(l.debe) || 0, Number(l.haber) || 0)
                    : null;

                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-card hover:bg-muted/20 transition-colors">
                      <div className="col-span-4">
                        <Select value={l.cuenta_id} onValueChange={v => updateLinea(i, "cuenta_id", v)}>
                          <SelectTrigger className="h-8 text-xs border-0 bg-transparent focus:ring-1">
                            <SelectValue placeholder="Seleccionar cuenta…" />
                          </SelectTrigger>
                          <SelectContent>
                            {cuentasActivas.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.codigo} — {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Input className="h-8 text-xs border-0 bg-transparent focus:ring-1"
                          value={l.descripcion}
                          onChange={e => updateLinea(i, "descripcion", e.target.value)}
                          placeholder="Descripción" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" className="h-8 text-xs text-right border-0 bg-transparent focus:ring-1"
                          value={l.debe || ""}
                          onChange={e => updateLinea(i, "debe", parseFloat(e.target.value) || 0)}
                          placeholder="0.00" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" className="h-8 text-xs text-right border-0 bg-transparent focus:ring-1"
                          value={l.haber || ""}
                          onChange={e => updateLinea(i, "haber", parseFloat(e.target.value) || 0)}
                          placeholder="0.00" />
                      </div>
                      <div className="col-span-1 flex items-center justify-center gap-1">
                        {badge ? (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded border font-mono ${badge.colors}`}>
                            {badge.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                        {lineas.length > 2 && (
                          <button onClick={() => removeLinea(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-muted/60 border-t border-border">
                <div className="col-span-7">
                  <button onClick={addLinea}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    <Plus className="h-3 w-3" /> Agregar línea
                  </button>
                </div>
                <div className="col-span-2 text-right font-mono font-semibold text-sm">{formatMoney(totalDebe)}</div>
                <div className="col-span-2 text-right font-mono font-semibold text-sm">{formatMoney(totalHaber)}</div>
                <div className="col-span-1 flex justify-center">
                  <span className={`text-xs font-bold ${balanced && (totalDebe > 0) ? "text-success" : balanced ? "text-muted-foreground" : "text-destructive"}`}>
                    {balanced && totalDebe > 0 ? "✓" : !balanced ? "✗" : "·"}
                  </span>
                </div>
              </div>
            </div>

            {!balanced && totalDebe > 0 && (
              <p className="text-xs text-destructive mt-1.5 font-medium">
                Diferencia: {formatMoney(Math.abs(totalDebe - totalHaber))} — debe estar balanceado.
              </p>
            )}
          </div>

          {/* Save / Reset */}
          <div className="flex gap-3 pt-1">
            <Button onClick={handleSave} disabled={!balanced || !glosa || totalDebe === 0} className="flex-1">
              {editId ? "Actualizar Comprobante" : "Guardar Comprobante"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Limpiar</Button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          FILTROS
      ══════════════════════════════════════════════ */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium mr-1">Filtrar:</span>
        {["TODOS", "BORRADOR", "CONTABILIZADO"].map(e => (
          <Button key={e} variant={filtroEstado === e ? "default" : "outline"} size="sm"
            onClick={() => setFiltroEstado(e)} className="text-xs">
            {e}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} comprobante{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ══════════════════════════════════════════════
          LISTA DE COMPROBANTES
      ══════════════════════════════════════════════ */}
      <div className="space-y-2">
        {filtered.map(c => {
          const dets = getDetallesForComprobante(c.id);
          const total = dets.reduce((s, d) => s + d.debe, 0);
          const isExpanded = expandedIds.has(c.id);

          return (
            <div key={c.id}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">

              {/* ── Fila resumen (siempre visible) ── */}
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                onClick={() => toggleExpand(c.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-muted-foreground shrink-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground shrink-0 hidden sm:block">{c.numero}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(c.fecha)}</span>
                  <span className="font-medium text-sm truncate">{c.glosa}</span>
                  <Badge variant={c.estado === "CONTABILIZADO" ? "default" : "secondary"} className="shrink-0 text-xs">
                    {c.estado === "CONTABILIZADO" ? "Contabilizado" : "Borrador"}
                  </Badge>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
                  <span className="font-mono text-sm font-semibold mr-2">{formatMoney(total)}</span>
                  <button onClick={() => handleEdit(c.id)} title="Editar"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  {c.estado === "BORRADOR" && (
                    <button onClick={() => handleContabilizar(c.id)} title="Contabilizar"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {c.estado === "CONTABILIZADO" && (
                    <button onClick={() => { pasarABorrador(c.id); toast.info("Pasado a borrador"); }} title="Pasar a borrador"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => { deleteComprobante(c.id); toast.success("Comprobante eliminado"); }}
                    title="Eliminar"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* ── Detalle expandido ── */}
              {isExpanded && (
                <div className="border-t border-border/60 bg-muted/10">
                  {c.referencia && (
                    <div className="px-5 pt-3 pb-1 text-xs text-muted-foreground">
                      <span className="font-semibold">Referencia:</span> {c.referencia}
                    </div>
                  )}
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="text-left py-2 pr-3 font-semibold w-8">Efecto</th>
                          <th className="text-left py-2 pr-4 font-semibold">Cuenta</th>
                          <th className="text-left py-2 pr-4 font-semibold hidden md:table-cell">Tipo</th>
                          <th className="text-left py-2 pr-4 font-semibold">Descripción</th>
                          <th className="text-right py-2 pr-4 font-semibold">Debe</th>
                          <th className="text-right py-2 font-semibold">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {dets.map(d => {
                          const cuenta = getCuenta(d.cuenta_id);
                          const badge = cuenta
                            ? getEffectBadge(cuenta.tipo, d.debe, d.haber)
                            : null;
                          return (
                            <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                              {/* Efecto badge */}
                              <td className="py-2 pr-3">
                                {badge ? (
                                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${badge.colors}`}>
                                    {badge.label}
                                  </span>
                                ) : <span className="text-muted-foreground/30">—</span>}
                              </td>
                              {/* Cuenta */}
                              <td className="py-2 pr-4">
                                <span className="font-mono text-xs text-muted-foreground mr-1">{cuenta?.codigo}</span>
                                <span className="font-medium">{cuenta?.nombre}</span>
                              </td>
                              {/* Tipo cuenta */}
                              <td className="py-2 pr-4 hidden md:table-cell">
                                {cuenta && (
                                  <span className="text-xs text-muted-foreground">
                                    {TIPO_LABELS[cuenta.tipo]}
                                  </span>
                                )}
                              </td>
                              {/* Descripción */}
                              <td className="py-2 pr-4 text-muted-foreground text-xs">{d.descripcion || "—"}</td>
                              {/* Debe */}
                              <td className="text-right py-2 pr-4 font-mono">
                                {d.debe > 0
                                  ? <span className="font-medium text-foreground">{formatMoney(d.debe)}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </td>
                              {/* Haber */}
                              <td className="text-right py-2 font-mono">
                                {d.haber > 0
                                  ? <span className="font-medium text-foreground">{formatMoney(d.haber)}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border font-bold text-sm">
                          <td colSpan={4} className="pt-2.5 pb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            Total
                          </td>
                          <td className="text-right pt-2.5 pb-2 pr-4 font-mono">
                            {formatMoney(dets.reduce((s, d) => s + d.debe, 0))}
                          </td>
                          <td className="text-right pt-2.5 pb-2 font-mono">
                            {formatMoney(dets.reduce((s, d) => s + d.haber, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-display font-medium mb-1">Sin comprobantes registrados</p>
            <p className="text-sm">Completá el formulario arriba para crear el primero.</p>
          </div>
        )}
      </div>
    </div>
  );
}
