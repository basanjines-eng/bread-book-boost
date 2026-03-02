import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getNaturaleza, type TipoCuenta } from "@/types/accounting";
import { Plus } from "lucide-react";

export default function PlanCuentas() {
  const { cuentas, addCuenta, updateCuenta } = useAccounting();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("ACTIVO");
  const [esCaja, setEsCaja] = useState(false);

  const handleAdd = () => {
    if (!codigo || !nombre) return;
    const nat = getNaturaleza(tipo);
    addCuenta({ codigo, nombre, tipo, ...nat, es_caja_banco: esCaja, activa: true });
    setCodigo(""); setNombre(""); setTipo("ACTIVO"); setEsCaja(false);
    setOpen(false);
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
        <h1 className="text-3xl font-display font-bold">Plan de Cuentas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Cuenta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Nueva Cuenta</DialogTitle></DialogHeader>
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
              <Button onClick={handleAdd} className="w-full">Agregar Cuenta</Button>
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
              {g.cuentas.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground w-12">{c.codigo}</span>
                    <span className="font-medium">{c.nombre}</span>
                    {c.es_caja_banco && <Badge variant="outline" className="text-xs">Caja/Banco</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{c.naturaleza}</span>
                    <span>↑{c.aumenta_en}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
