import { useState } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate, today } from "@/lib/accounting";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function VentasPage() {
  const { productos, cuentas, stock, ventas, getProducto, getCuenta, registrarVenta, getStockForProducto } = useAccounting();

  const [fecha, setFecha] = useState(today());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [totalVenta, setTotalVenta] = useState("");
  const [formaCobro, setFormaCobro] = useState("");

  const cuentasCaja = cuentas.filter(c => c.es_caja_banco || c.codigo === 'A1.5');
  const stk = productoId ? getStockForProducto(productoId) : null;
  const cantNum = parseFloat(cantidad) || 0;
  const totalNum = parseFloat(totalVenta) || 0;
  const costoEst = stk ? stk.costo_promedio * cantNum : 0;
  const margen = totalNum - costoEst;
  const margenPct = totalNum > 0 ? (margen / totalNum) * 100 : 0;

  const handleVenta = () => {
    if (!productoId || !cantidad || !totalVenta || !formaCobro) {
      toast.error("Complete todos los campos"); return;
    }
    if (stk && cantNum > stk.cantidad_actual) {
      toast.error(`Stock insuficiente. Disponible: ${stk.cantidad_actual}`); return;
    }
    const result = registrarVenta({
      fecha, producto_id: productoId,
      cantidad_vendida: cantNum,
      total_venta: totalNum,
      forma_cobro_cuenta_id: formaCobro,
    });
    if (result) {
      toast.success("Venta registrada y contabilizada");
      setProductoId(""); setCantidad(""); setTotalVenta(""); setFormaCobro("");
    } else {
      toast.error("Error al registrar la venta");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Ventas</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="font-display">Registrar Venta</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div>
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {productos.filter(p => p.activo).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stk && <p className="text-xs text-muted-foreground mt-1">Disponible: {stk.cantidad_actual} | CPP: {formatMoney(stk.costo_promedio)}</p>}
            </div>
            <div><Label>Cantidad</Label><Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" /></div>
            <div><Label>Total Venta (Bs)</Label><Input type="number" value={totalVenta} onChange={e => setTotalVenta(e.target.value)} min="0" /></div>
            <div>
              <Label>Forma de Cobro</Label>
              <Select value={formaCobro} onValueChange={setFormaCobro}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cuentasCaja.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cantNum > 0 && totalNum > 0 && (
              <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
                <div className="flex justify-between"><span>Costo estimado:</span><span>{formatMoney(costoEst)}</span></div>
                <div className="flex justify-between"><span>Margen:</span><span className={margen >= 0 ? 'text-success' : 'text-destructive'}>{formatMoney(margen)}</span></div>
                <div className="flex justify-between"><span>Margen %:</span><span>{margenPct.toFixed(1)}%</span></div>
              </div>
            )}

            <Button onClick={handleVenta} className="w-full">Registrar Venta</Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Historial de Ventas</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Venta</th>
                    <th className="text-right py-2">Costo</th>
                    <th className="text-right py-2">Margen</th>
                    <th className="text-right py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ventas].reverse().map(v => (
                    <tr key={v.id} className="border-b border-border/50">
                      <td className="py-2">{formatDate(v.fecha)}</td>
                      <td className="py-2">{getProducto(v.producto_id)?.nombre}</td>
                      <td className="text-right py-2">{v.cantidad_vendida}</td>
                      <td className="text-right py-2">{formatMoney(v.total_venta)}</td>
                      <td className="text-right py-2">{formatMoney(v.costo_total_venta)}</td>
                      <td className={`text-right py-2 ${v.margen >= 0 ? 'text-success' : 'text-destructive'}`}>{formatMoney(v.margen)}</td>
                      <td className="text-right py-2">{v.margen_porcentaje.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ventas.length === 0 && <p className="text-center text-muted-foreground py-4">Sin ventas registradas</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
