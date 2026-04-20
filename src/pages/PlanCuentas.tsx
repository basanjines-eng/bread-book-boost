import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getNaturaleza, type TipoCuenta } from "@/types/accounting";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import type { Cuenta } from "@/types/accounting";

export default function PlanCuentas() {
  const { cuentas, addCuenta, updateCuenta, deleteCuenta, cuentaTieneMovimientos } = useAccounting();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("ACTIVO");
  const [esCaja, setEsCaja] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cuenta | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setCodigo(""); setNombre(""); setTipo("ACTIVO"); setEsCaja(false);
    setOpen(false);
  };

  const handleSave = () => {
    if (!codigo.trim() || !nombre.trim()) {
      toast.error("Código y nombre son obligatorios");
      return;
    }
    const nat = getNaturaleza(tipo);
    if (editingId) {
      const original = cuentas.find(c => c.id === editingId);
      if (!original) return;
      updateCuenta({
        ...original, codigo: codigo.trim(), nombre: nombre.trim(),
        tipo, ...nat, es_caja_banco: esCaja,
      });
      toast.success("Cuenta actualizada");
    } else {
      if (cuentas.some(c => c.codigo.toLowerCase() === codigo.trim().toLowerCase())) {
        toast.error("Ya existe una cuenta con ese código");
        return;
      }
      addCuenta({ codigo: codigo.trim(), nombre: nombre.trim(), tipo, ...nat, es_caja_banco: esCaja, activa: true });
      toast.success("Cuenta creada");
    }
    resetForm();
  };

  const handleEdit = (c: Cuenta) => {
    setEditingId(c.id);
    setCodigo(c.codigo);
    setNombre(c.nombre);
    setTipo(c.tipo);
    setEsCaja(c.es_caja_banco);
    setOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const result = deleteCuenta(deleteTarget.id);
    if (result.ok) {
      toast.success(`Cuenta "${deleteTarget.nombre}" eliminada`);
    } else {
      toast.error(result.reason || "No se pudo eliminar la cuenta");
    }
    setDeleteTarget(null);
  };

  const tipos: TipoCuenta[] = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'];
  const grouped = tipos.map(t => ({ tipo: t, cuentas: cuentas.filter(c => c.tipo === t) }));

  const tipoBadgeColor: Record<string, string> = {
    ACTIVO: 'bg-primary/10 text-primary',
    PASIVO: 'bg-destructive/10 text-destructive',
    PATRIMONIO: 'bg-accent text-accent-foreground',
    INGRESO: 'bg-success/10 text-success',
    GASTO: 'bg-warning/10 text-warning-foreground',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Plan de Cuentas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona las cuentas contables de tu negocio. Las cuentas con movimientos no pueden eliminarse.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nueva Cuenta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? 'Editar Cuenta' : 'Nueva Cuenta'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Código</Label><Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej: A1.8" /></div>
              <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la cuenta" /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCuenta)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={esCaja} onChange={e => setEsCaja(e.target.checked)} id="escaja" className="rounded" />
                <Label htmlFor="escaja">¿Es cuenta de caja/banco?</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">{editingId ? 'Guardar cambios' : 'Agregar Cuenta'}</Button>
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {grouped.map(g => (
        <Card key={g.tipo}>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Badge className={tipoBadgeColor[g.tipo]}>{g.tipo}</Badge>
              <span className="text-muted-foreground text-sm font-normal">({g.cuentas.length} cuentas)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {g.cuentas.map(c => {
                const conMov = cuentaTieneMovimientos(c.id);
                return (
                  <div key={c.id} className="group flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-mono text-sm text-muted-foreground w-16 shrink-0">{c.codigo}</span>
                      <span className="font-medium truncate">{c.nombre}</span>
                      {c.es_caja_banco && <Badge variant="outline" className="text-xs shrink-0">Caja/Banco</Badge>}
                      {conMov && (
                        <Badge variant="outline" className="text-xs shrink-0 gap-1 text-muted-foreground">
                          <Lock className="h-3 w-3" /> con movimientos
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.naturaleza}</span>
                        <span>↑{c.aumenta_en}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => handleEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title={conMov ? 'No se puede eliminar: tiene movimientos' : 'Eliminar cuenta'}
                          disabled={conMov}
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {g.cuentas.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-3 py-2">No hay cuentas en esta categoría.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta "{deleteTarget?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La cuenta <span className="font-mono font-semibold">{deleteTarget?.codigo}</span> será eliminada del plan de cuentas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
