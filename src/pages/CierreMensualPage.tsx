import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Unlock, FileDown } from "lucide-react";

export default function CierreMensualPage() {
  const { cierres, cerrarMes, reabrirMes } = useAccounting();
  const navigate = useNavigate();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [nota, setNota] = useState("");

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handleCerrar = (mes: number) => {
    cerrarMes(anio, mes, nota);
    toast.success(`${meses[mes - 1]} ${anio} cerrado`);
    setNota("");
  };

  const handleExportar = (mes: number) => {
    const mesStr = `${anio}-${String(mes).padStart(2, '0')}`;
    navigate(`/impresion-mensual?mes=${mesStr}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Cierre Mensual</h1>

      <div className="flex items-center gap-4">
        <Label>Año</Label>
        <Input type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value))} className="w-32" />
        <Label>Nota</Label>
        <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota opcional" className="max-w-xs" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {meses.map((m, i) => {
          const cierre = cierres.find(c => c.anio === anio && c.mes === i + 1);
          const cerrado = cierre?.cerrado || false;
          return (
            <Card key={i} className={cerrado ? 'border-success/30' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-semibold">{m}</span>
                  <Badge variant={cerrado ? 'default' : 'secondary'}>
                    {cerrado ? <><Lock className="h-3 w-3 mr-1" />Cerrado</> : 'Abierto'}
                  </Badge>
                </div>
                {cerrado ? (
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { reabrirMes(anio, i + 1); toast.info(`${m} reabierto`); }}>
                      <Unlock className="h-3 w-3 mr-1" />Reabrir
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => handleExportar(i + 1)}>
                      <FileDown className="h-3 w-3 mr-1" />Exportar PDF del mes
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => handleCerrar(i + 1)}>
                    <Lock className="h-3 w-3 mr-1" />Cerrar Mes
                  </Button>
                )}
                {cierre?.nota && <p className="text-xs text-muted-foreground mt-2">{cierre.nota}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
