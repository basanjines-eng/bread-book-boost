import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, RefreshCw } from "lucide-react";

export default function ConfiguracionPage() {
  const resetData = () => {
    if (confirm('¿Está seguro? Esto eliminará todos los datos.')) {
      localStorage.removeItem('panconta_data');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Configuración</h1>

      <Card>
        <CardHeader><CardTitle className="font-display">Datos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Los datos se almacenan localmente en el navegador. Se recomienda migrar a una base de datos para producción.
          </p>
          <div className="flex gap-4">
            <Button variant="destructive" onClick={resetData}>
              <Trash2 className="h-4 w-4 mr-2" />Reiniciar Datos
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />Recargar App
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Acerca de PanConta</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sistema de contabilidad por partida doble para panadería. 
            Versión 1.0 — Todos los cálculos se realizan automáticamente desde comprobantes contabilizados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
