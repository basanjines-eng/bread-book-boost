import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";

export default function ProduccionPage() {
  const { productos, producciones, addProduccion, confirmarProduccion, getProducto } = useAccounting();

  const [fecha, setFecha] = useState(today());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoTotal, setCostoTotal] = useState("");

  const cantNum = parseFloat(cantidad) || 0;
  const costoNum = parseFloat(costoTotal) || 0;
  const costoUnit = cantNum > 0 ? costoNum / cantNum : 0;

  const handleAdd = () => {
    if (!productoId || cantNum <= 0 || costoNum <= 0) {
      toast.error("Complete todos los campos"); return;
    }
    addProduccion({ fecha, producto_id: productoId, cantidad_producida: cantNum, costo_total_produccion: costoNum, estado: 'BORRADOR' });
    toast.success("Producción registrada");
    setProductoId(""); setCantidad(""); setCostoTotal("");
  };

  const handleConfirmar = (id: string) => {
    confirmarProduccion(id);
    toast.success("Producción confirmada y contabilizada");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Producción</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-display">Registrar Producción</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div>
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {productos.filter(p => p.activo).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cantidad Producida</Label><Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" /></div>
            <div><Label>Costo Total Producción (Bs)</Label><Input type="number" value={costoTotal} onChange={e => setCostoTotal(e.target.value)} min="0" /></div>
            {cantNum > 0 && costoNum > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                Costo Unitario: <strong>{formatMoney(costoUnit)}</strong>
              </div>
            )}
            <Button onClick={handleAdd} className="w-full"><Plus className="h-4 w-4 mr-2" />Registrar</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Historial de Producción</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cantidad</th>
                    <th className="text-right py-2">Costo Total</th>
                    <th className="text-right py-2">C. Unit.</th>
                    <th className="text-center py-2">Estado</th>
                    <th className="text-center py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[...producciones].reverse().map(p => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2">{formatDate(p.fecha)}</td>
                      <td className="py-2">{getProducto(p.producto_id)?.nombre}</td>
                      <td className="text-right py-2">{p.cantidad_producida}</td>
                      <td className="text-right py-2">{formatMoney(p.costo_total_produccion)}</td>
                      <td className="text-right py-2">{formatMoney(p.costo_unitario)}</td>
                      <td className="text-center py-2">
                        <Badge variant={p.estado === 'CONFIRMADA' ? 'default' : 'secondary'}>{p.estado}</Badge>
                      </td>
                      <td className="text-center py-2">
                        {p.estado === 'BORRADOR' && (
                          <Button size="sm" variant="ghost" onClick={() => handleConfirmar(p.id)}>
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {producciones.length === 0 && <p className="text-center text-muted-foreground py-4">Sin producciones</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
