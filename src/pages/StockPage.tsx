import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatMoney, today } from "@/lib/accounting";
import { Package, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function StockPage() {
  const { stock, getProducto, registrarMerma } = useAccounting();

  const [mermaTarget, setMermaTarget] = useState<string | null>(null);
  const [mermaFecha, setMermaFecha] = useState(today());
  const [mermaCantidad, setMermaCantidad] = useState("");
  const [mermaMotivo, setMermaMotivo] = useState("");
  const [mermaTotal, setMermaTotal] = useState(false);

  const stockTarget = mermaTarget ? stock.find(s => s.producto_id === mermaTarget) : null;
  const productoTarget = mermaTarget ? getProducto(mermaTarget) : null;

  const cantidadMerma = mermaTotal
    ? (stockTarget?.cantidad_actual ?? 0)
    : (parseFloat(mermaCantidad) || 0);

  const costoEstimado = cantidadMerma * (stockTarget?.costo_promedio ?? 0);

  const openMermaDialog = (producto_id: string) => {
    setMermaTarget(producto_id);
    setMermaFecha(today());
    setMermaCantidad("");
    setMermaMotivo("");
    setMermaTotal(false);
  };

  const handleConfirmarMerma = () => {
    if (!mermaTarget) return;
    if (cantidadMerma <= 0) { toast.error("La cantidad debe ser mayor a 0"); return; }
    if (!mermaTotal && cantidadMerma > (stockTarget?.cantidad_actual ?? 0)) {
      toast.error("La cantidad supera el stock disponible"); return;
    }
    const ok = registrarMerma(mermaTarget, cantidadMerma, mermaFecha, mermaMotivo);
    if (ok) {
      toast.success(`Merma registrada: ${productoTarget?.nombre} x${cantidadMerma} — Pérdida: ${formatMoney(costoEstimado)}`);
      setMermaTarget(null);
    } else {
      toast.error("No se pudo registrar. Verifica que haya stock y que existan las cuentas G1.8 y A1.7.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Producto Terminado</h1>
      <p className="text-muted-foreground">Stock de productos terminados listos para la venta.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stock.map(s => {
          const prod = getProducto(s.producto_id);
          const sinStock = s.cantidad_actual <= 0;
          return (
            <Card key={s.id} className={sinStock ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="font-display flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {prod?.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cantidad</p>
                    <p className={`text-2xl font-display font-bold ${s.cantidad_actual < 0 ? 'text-destructive' : ''}`}>
                      {s.cantidad_actual}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPP</p>
                    <p className="text-lg font-medium">{formatMoney(s.costo_promedio)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className={`font-medium ${s.valor_actual < 0 ? 'text-destructive' : ''}`}>
                    {formatMoney(s.valor_actual)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sinStock}
                  onClick={() => openMermaDialog(s.producto_id)}
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 mt-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Registrar Merma
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!mermaTarget} onOpenChange={v => !v && setMermaTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Registrar Merma
            </DialogTitle>
            <DialogDescription>
              Se registrará una pérdida contable en el Libro Diario usando la cuenta <strong>G1.8 — Mermas de Producción</strong>.
            </DialogDescription>
          </DialogHeader>

          {stockTarget && productoTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                <p className="font-semibold text-base">{productoTarget.nombre}</p>
                <div className="flex gap-6 text-muted-foreground">
                  <span>Stock actual: <strong className="text-foreground">{stockTarget.cantidad_actual} u.</strong></span>
                  <span>CPP: <strong className="text-foreground">{formatMoney(stockTarget.costo_promedio)}</strong></span>
                </div>
              </div>

              <div>
                <Label>Fecha de merma</Label>
                <Input type="date" value={mermaFecha} onChange={e => setMermaFecha(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Cantidad a dar de baja</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={mermaTotal ? "default" : "outline"} size="sm"
                    onClick={() => { setMermaTotal(true); setMermaCantidad(""); }}>
                    Todo ({stockTarget.cantidad_actual} u.)
                  </Button>
                  <Button type="button" variant={!mermaTotal ? "default" : "outline"} size="sm"
                    onClick={() => setMermaTotal(false)}>
                    Parcial
                  </Button>
                </div>
                {!mermaTotal && (
                  <Input type="number" placeholder={`Máx. ${stockTarget.cantidad_actual}`}
                    value={mermaCantidad} onChange={e => setMermaCantidad(e.target.value)}
                    min="1" max={stockTarget.cantidad_actual} />
                )}
              </div>

              <div>
                <Label>Motivo <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input value={mermaMotivo} onChange={e => setMermaMotivo(e.target.value)}
                  placeholder="Ej: Vencimiento, daño, deterioro..." />
              </div>

              {cantidadMerma > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm space-y-1">
                  <p className="font-semibold text-destructive">Impacto contable estimado</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unidades dadas de baja:</span>
                    <strong>{cantidadMerma}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pérdida registrada:</span>
                    <strong className="text-destructive">{formatMoney(costoEstimado)}</strong>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Comprobante: DEBE G1.8 Mermas / HABER A1.7 Prod. Terminado
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setMermaTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmarMerma} disabled={cantidadMerma <= 0}>
              <Trash2 className="h-4 w-4 mr-1" />
              Confirmar Merma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
