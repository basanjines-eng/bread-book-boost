import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/accounting";
import { Package } from "lucide-react";

export default function StockPage() {
  const { stock, getProducto } = useAccounting();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Producto Terminado</h1>
      <p className="text-muted-foreground">Stock de productos terminados listos para la venta.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stock.map(s => {
          const prod = getProducto(s.producto_id);
          return (
            <Card key={s.id}>
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
                    <p className="text-2xl font-display font-bold">{s.cantidad_actual}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPP</p>
                    <p className="text-lg font-medium">{formatMoney(s.costo_promedio)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-medium">{formatMoney(s.valor_actual)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
