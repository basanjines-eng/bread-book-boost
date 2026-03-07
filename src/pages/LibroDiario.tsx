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

export default function LibroDiario() {
  const {
    comprobantes, cuentas, addComprobante, updateComprobante,
    deleteComprobante, contabilizar, pasarABorrador,
    getDetallesForComprobante, isMesCerrado, getCuenta,
  } = useAccounting();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(today());
  const [glosa, setGlosa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [lineas, setLineas] = useState<{ cuenta_id: string; descripcion: string; debe: number; haber: number }[]>([
    { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
    { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
  ]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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
    setShowForm(false);
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
    setShowForm(true);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Libro Diario</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />Nuevo Comprobante
          </Button>
        )}
      </div>

      {/* INLINE FORM */}
      {showForm && (
        <div className="rounded-xl border-2 border-primary/40 bg-card shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-primary/10 border-b border-primary/20">
            <h2 className="font-display font-semibold text-primary text-base">
              {editId ? "✏️  Editar Comprobante" : "➕  Nuevo Comprobante"}
            </h2>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
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

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">Detalle</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="col-span-4">Cuenta</div>
                  <div className="col-span-3">Descripción</div>
                  <div className="col-span-2 text-right">Debe</div>
                  <div className="col-span-2 text-right">Haber</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="divide-y divide-border/50">
                  {lineas.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-card hover:bg-muted/30 transition-colors">
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
                        <Input className="h-8 text-xs border-0 bg-transparent focus:ring-1" value={l.descripcion}
                          onChange={e => updateLinea(i, "descripcion", e.target.value)} placeholder="Descripción" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" className="h-8 text-xs text-right border-0 bg-transparent focus:ring-1"
                          value={l.debe || ""} onChange={e => updateLinea(i, "debe", parseFloat(e.target.value) || 0)} placeholder="0.00" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" className="h-8 text-xs text-right border-0 bg-transparent focus:ring-1"
                          value={l.haber || ""} onChange={e => updateLinea(i, "haber", parseFloat(e.target.value) || 0)} placeholder="0.00" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {lineas.length > 2 && (
                          <button onClick={() => removeLinea(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-muted/60 border-t border-border font-semibold text-sm">
                  <div className="col-span-7">
                    <button onClick={addLinea} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                      <Plus className="h-3 w-3" /> Agregar línea
                    </button>
                  </div>
                  <div className="col-span-2 text-right font-mono">{formatMoney(totalDebe)}</div>
                  <div className="col-span-2 text-right font-mono">{formatMoney(totalHaber)}</div>
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-xs font-bold ${balanced ? "text-success" : "text-destructive"}`}>
                      {balanced ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              </div>
              {!balanced && (
                <p className="text-xs text-destructive mt-1.5 font-medium">
                  Diferencia: {formatMoney(Math.abs(totalDebe - totalHaber))} — debe estar balanceado.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button onClick={handleSave} disabled={!balanced || !glosa} className="flex-1">
                {editId ? "Actualizar Comprobante" : "Guardar Comprobante"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
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

      {/* Comprobantes list */}
      <div className="space-y-2">
        {filtered.map(c => {
          const dets = getDetallesForComprobante(c.id);
          const total = dets.reduce((s, d) => s + d.debe, 0);
          const isExpanded = expandedIds.has(c.id);

          return (
            <div key={c.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
              {/* Summary row */}
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
                  <button onClick={() => { deleteComprobante(c.id); toast.success("Comprobante eliminado"); }} title="Eliminar"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border/60 bg-muted/20">
                  {c.referencia && (
                    <div className="px-5 pt-3 pb-1 text-xs text-muted-foreground">
                      <span className="font-semibold">Referencia:</span> {c.referencia}
                    </div>
                  )}
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="text-left py-2 pr-4 font-semibold">Cuenta</th>
                          <th className="text-left py-2 pr-4 font-semibold">Descripción</th>
                          <th className="text-right py-2 pr-4 font-semibold">Debe</th>
                          <th className="text-right py-2 font-semibold">Haber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {dets.map(d => (
                          <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-4">
                              <span className="font-mono text-xs text-muted-foreground mr-1">{getCuenta(d.cuenta_id)?.codigo}</span>
                              <span>{getCuenta(d.cuenta_id)?.nombre}</span>
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground text-xs">{d.descripcion || "—"}</td>
                            <td className="text-right py-2 pr-4 font-mono">
                              {d.debe > 0 ? <span className="font-medium">{formatMoney(d.debe)}</span> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="text-right py-2 font-mono">
                              {d.haber > 0 ? <span className="font-medium">{formatMoney(d.haber)}</span> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border font-bold text-sm">
                          <td colSpan={2} className="pt-2.5 pb-2 text-xs uppercase tracking-wide text-muted-foreground">Total</td>
                          <td className="text-right pt-2.5 pb-2 pr-4 font-mono">{formatMoney(dets.reduce((s, d) => s + d.debe, 0))}</td>
                          <td className="text-right pt-2.5 pb-2 font-mono">{formatMoney(dets.reduce((s, d) => s + d.haber, 0))}</td>
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
            <p className="text-lg font-display font-medium mb-1">Sin comprobantes</p>
            <p className="text-sm">Creá el primero con el botón "Nuevo Comprobante".</p>
          </div>
        )}
      </div>
    </div>
  );
}
