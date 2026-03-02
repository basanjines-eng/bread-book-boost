import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { Plus, Trash2, Eye, Edit, Check } from "lucide-react";
import type { ComprobanteDetalle } from "@/types/accounting";
import { toast } from "sonner";

export default function LibroDiario() {
  const {
    comprobantes, cuentas, addComprobante, updateComprobante,
    deleteComprobante, contabilizar, pasarABorrador,
    getDetallesForComprobante, isMesCerrado, getCuenta,
  } = useAccounting();

  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(today());
  const [glosa, setGlosa] = useState("");
  const [referencia, setReferencia] = useState("");
  const [lineas, setLineas] = useState<{ cuenta_id: string; descripcion: string; debe: number; haber: number }[]>([
    { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
    { cuenta_id: "", descripcion: "", debe: 0, haber: 0 },
  ]);

  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

  const activos = comprobantes.filter(c => !c.deleted_at);
  const filtered = filtroEstado === "TODOS" ? activos : activos.filter(c => c.estado === filtroEstado);

  const addLinea = () => setLineas([...lineas, { cuenta_id: "", descripcion: "", debe: 0, haber: 0 }]);
  const removeLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: string, value: any) => {
    setLineas(lineas.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const totalDebe = lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);
  const balanced = Math.abs(totalDebe - totalHaber) < 0.01;

  const resetForm = () => {
    setFecha(today()); setGlosa(""); setReferencia("");
    setLineas([{ cuenta_id: "", descripcion: "", debe: 0, haber: 0 }, { cuenta_id: "", descripcion: "", debe: 0, haber: 0 }]);
  };

  const handleSave = () => {
    if (!glosa) { toast.error("La glosa es obligatoria"); return; }
    if (lineas.some(l => !l.cuenta_id)) { toast.error("Seleccione cuenta en todas las líneas"); return; }
    if (isMesCerrado(fecha)) { toast.error("El mes está cerrado"); return; }

    if (editId) {
      const comp = comprobantes.find(c => c.id === editId)!;
      updateComprobante(
        { ...comp, fecha, glosa, referencia, estado: 'BORRADOR' },
        lineas.map(l => ({ cuenta_id: l.cuenta_id, descripcion: l.descripcion, debe: Number(l.debe) || 0, haber: Number(l.haber) || 0 }))
      );
      toast.success("Comprobante actualizado");
      setEditId(null);
    } else {
      addComprobante(
        { fecha, glosa, referencia, estado: 'BORRADOR' },
        lineas.map(l => ({ cuenta_id: l.cuenta_id, descripcion: l.descripcion, debe: Number(l.debe) || 0, haber: Number(l.haber) || 0 }))
      );
      toast.success("Comprobante creado");
    }
    resetForm();
    setOpen(false);
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
    if (comp.estado === 'CONTABILIZADO') {
      pasarABorrador(id);
      toast.info("Comprobante pasado a BORRADOR para edición");
    }
    const dets = getDetallesForComprobante(id);
    setFecha(comp.fecha);
    setGlosa(comp.glosa);
    setReferencia(comp.referencia || "");
    setLineas(dets.map(d => ({ cuenta_id: d.cuenta_id, descripcion: d.descripcion, debe: d.debe, haber: d.haber })));
    setEditId(id);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteComprobante(id);
    toast.success("Comprobante eliminado");
  };

  const viewComp = viewId ? comprobantes.find(c => c.id === viewId) : null;
  const viewDets = viewId ? getDetallesForComprobante(viewId) : [];

  const cuentasActivas = cuentas.filter(c => c.activa);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Libro Diario</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { resetForm(); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Comprobante</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">{editId ? 'Editar' : 'Nuevo'} Comprobante</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                <div><Label>Referencia</Label><Input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Opcional" /></div>
              </div>
              <div><Label>Glosa *</Label><Input value={glosa} onChange={e => setGlosa(e.target.value)} placeholder="Descripción del comprobante" /></div>

              <div className="space-y-2">
                <Label>Detalle</Label>
                {lineas.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Select value={l.cuenta_id} onValueChange={v => updateLinea(i, 'cuenta_id', v)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                        <SelectContent>
                          {cuentasActivas.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input className="text-xs" value={l.descripcion} onChange={e => updateLinea(i, 'descripcion', e.target.value)} placeholder="Descripción" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" className="text-xs" value={l.debe || ''} onChange={e => updateLinea(i, 'debe', parseFloat(e.target.value) || 0)} placeholder="Debe" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" className="text-xs" value={l.haber || ''} onChange={e => updateLinea(i, 'haber', parseFloat(e.target.value) || 0)} placeholder="Haber" />
                    </div>
                    <div className="col-span-1">
                      {lineas.length > 2 && <Button variant="ghost" size="sm" onClick={() => removeLinea(i)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLinea}><Plus className="h-3 w-3 mr-1" />Línea</Button>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                <span className="text-sm">Debe: <strong>{formatMoney(totalDebe)}</strong></span>
                <span className={`text-sm font-medium ${balanced ? 'text-success' : 'text-destructive'}`}>
                  {balanced ? '✓ Balanceado' : '✗ Desbalanceado'}
                </span>
                <span className="text-sm">Haber: <strong>{formatMoney(totalHaber)}</strong></span>
              </div>

              <Button onClick={handleSave} className="w-full">{editId ? 'Actualizar' : 'Guardar'} Comprobante</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        {['TODOS', 'BORRADOR', 'CONTABILIZADO'].map(e => (
          <Button key={e} variant={filtroEstado === e ? 'default' : 'outline'} size="sm" onClick={() => setFiltroEstado(e)}>
            {e}
          </Button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(c => {
          const dets = getDetallesForComprobante(c.id);
          const total = dets.reduce((s, d) => s + d.debe, 0);
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">{c.numero}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(c.fecha)}</span>
                    <span className="font-medium">{c.glosa}</span>
                    <Badge variant={c.estado === 'CONTABILIZADO' ? 'default' : 'secondary'}>
                      {c.estado}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm mr-2">{formatMoney(total)}</span>
                    <Button variant="ghost" size="sm" onClick={() => setViewId(c.id)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(c.id)}><Edit className="h-4 w-4" /></Button>
                    {c.estado === 'BORRADOR' && (
                      <Button variant="ghost" size="sm" onClick={() => handleContabilizar(c.id)}><Check className="h-4 w-4 text-success" /></Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No hay comprobantes</p>
        )}
      </div>

      {/* View dialog */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Comprobante {viewComp?.numero}</DialogTitle></DialogHeader>
          {viewComp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Fecha:</span> {formatDate(viewComp.fecha)}</div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge>{viewComp.estado}</Badge></div>
                <div className="col-span-2"><span className="text-muted-foreground">Glosa:</span> {viewComp.glosa}</div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Cuenta</th>
                    <th className="text-left py-2">Descripción</th>
                    <th className="text-right py-2">Debe</th>
                    <th className="text-right py-2">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {viewDets.map(d => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2">{getCuenta(d.cuenta_id)?.codigo} - {getCuenta(d.cuenta_id)?.nombre}</td>
                      <td className="py-2">{d.descripcion}</td>
                      <td className="text-right py-2">{d.debe > 0 ? formatMoney(d.debe) : ''}</td>
                      <td className="text-right py-2">{d.haber > 0 ? formatMoney(d.haber) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={2} className="py-2">TOTAL</td>
                    <td className="text-right py-2">{formatMoney(viewDets.reduce((s, d) => s + d.debe, 0))}</td>
                    <td className="text-right py-2">{formatMoney(viewDets.reduce((s, d) => s + d.haber, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
