import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Building2, Calculator } from "lucide-react";
import { formatMoney, today } from "@/lib/accounting";

interface ActivoFijo {
  id: string;
  nombre: string;
  descripcion: string;
  fechaAdquisicion: string;
  costoAdquisicion: number;
  vidaUtilAnios: number;
  cuentaActivoId: string;  // A2.1, A2.2, A2.3
  comprobanteAdqId: string;
  depreciacionesRegistradas: number; // meses depreciados
}

const STORAGE_KEY = 'panconta_activos_fijos';

function loadActivos(): ActivoFijo[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveActivos(a: ActivoFijo[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }

export default function ActivosFijosPage() {
  const {
    cuentas, addComprobante, contabilizar, isMesCerrado, getCuentaByCodigo,
    comprobantes, detalles,
  } = useAccounting();

  const [activos, setActivos] = useState<ActivoFijo[]>(loadActivos);

  // Form
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaAdq, setFechaAdq] = useState(today());
  const [costo, setCosto] = useState("");
  const [vidaUtil, setVidaUtil] = useState("5");
  const [cuentaActivoCode, setCuentaActivoCode] = useState("A2.1");
  const [cuentaPagoId, setCuentaPagoId] = useState("");

  // Depreciation
  const [depAnio, setDepAnio] = useState(new Date().getFullYear());
  const [depMes, setDepMes] = useState(new Date().getMonth() + 1);

  const cuentasCajaBanco = useMemo(() => cuentas.filter(c => c.es_caja_banco && c.activa), [cuentas]);

  const cuentasActivo = [
    { codigo: 'A2.1', nombre: 'Muebles y Enseres' },
    { codigo: 'A2.2', nombre: 'Maquinaria y Equipo' },
    { codigo: 'A2.3', nombre: 'Equipos de Cómputo' },
  ];

  // Compute depreciation acumulada from contabilized entries
  const depAcumuladaPorActivo = useMemo(() => {
    const result: Record<string, number> = {};
    // Count depreciation comprobantes per activo from glosa
    const contabIds = new Set(comprobantes.filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at && c.glosa.startsWith('Depreciación mensual')).map(c => c.id));
    // We track via the activos state depreciacionesRegistradas
    for (const a of activos) {
      result[a.id] = a.depreciacionesRegistradas * (a.costoAdquisicion / (a.vidaUtilAnios * 12));
    }
    return result;
  }, [activos, comprobantes]);

  const handleRegistrarActivo = () => {
    if (!nombre.trim()) { toast.error("Ingrese nombre del activo"); return; }
    const costoNum = parseFloat(costo);
    if (!costoNum || costoNum <= 0) { toast.error("Ingrese costo válido"); return; }
    const vidaNum = parseInt(vidaUtil);
    if (!vidaNum || vidaNum <= 0) { toast.error("Ingrese vida útil válida"); return; }
    if (!cuentaPagoId) { toast.error("Seleccione cuenta de pago"); return; }
    if (isMesCerrado(fechaAdq)) { toast.error("El mes está cerrado"); return; }

    const cActivo = getCuentaByCodigo(cuentaActivoCode);
    if (!cActivo) { toast.error("Cuenta de activo no encontrada"); return; }

    const compId = addComprobante(
      { fecha: fechaAdq, glosa: `Adquisición activo fijo: ${nombre}`, estado: 'BORRADOR' },
      [
        { cuenta_id: cActivo.id, descripcion: `Compra ${nombre}`, debe: costoNum, haber: 0 },
        { cuenta_id: cuentaPagoId, descripcion: `Pago ${nombre}`, debe: 0, haber: costoNum },
      ]
    );
    contabilizar(compId);

    const nuevoActivo: ActivoFijo = {
      id: crypto.randomUUID(), nombre, descripcion, fechaAdquisicion: fechaAdq,
      costoAdquisicion: costoNum, vidaUtilAnios: vidaNum, cuentaActivoId: cActivo.id,
      comprobanteAdqId: compId, depreciacionesRegistradas: 0,
    };
    const updated = [...activos, nuevoActivo];
    setActivos(updated);
    saveActivos(updated);
    setNombre(""); setDescripcion(""); setCosto(""); setVidaUtil("5");
    toast.success(`Activo "${nombre}" registrado`);
  };

  const handleDepreciarMes = () => {
    if (activos.length === 0) { toast.error("No hay activos registrados"); return; }
    const fechaRef = `${depAnio}-${String(depMes).padStart(2, '0')}-28`;
    if (isMesCerrado(fechaRef)) { toast.error("El mes está cerrado"); return; }

    const cDepreciacion = getCuentaByCodigo('G1.11');
    const cDepAcum = getCuentaByCodigo('A2.9');
    if (!cDepreciacion || !cDepAcum) { toast.error("Faltan cuentas de depreciación"); return; }

    // Filter activos that still have remaining life
    const activosDepreciar = activos.filter(a => {
      const mesesVida = a.vidaUtilAnios * 12;
      return a.depreciacionesRegistradas < mesesVida;
    });

    if (activosDepreciar.length === 0) { toast.error("Todos los activos están totalmente depreciados"); return; }

    let totalDep = 0;
    const descripcionesDets: { cuenta_id: string; descripcion: string; debe: number; haber: number }[] = [];

    for (const a of activosDepreciar) {
      const depMensual = a.costoAdquisicion / (a.vidaUtilAnios * 12);
      totalDep += depMensual;
    }

    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const compId = addComprobante(
      { fecha: fechaRef, glosa: `Depreciación mensual — ${meses[depMes]} ${depAnio}`, estado: 'BORRADOR' },
      [
        { cuenta_id: cDepreciacion.id, descripcion: `Gasto depreciación ${meses[depMes]} ${depAnio}`, debe: totalDep, haber: 0 },
        { cuenta_id: cDepAcum.id, descripcion: `Depreciación acumulada ${meses[depMes]} ${depAnio}`, debe: 0, haber: totalDep },
      ]
    );
    contabilizar(compId);

    const updated = activos.map(a => {
      if (activosDepreciar.find(ad => ad.id === a.id)) {
        return { ...a, depreciacionesRegistradas: a.depreciacionesRegistradas + 1 };
      }
      return a;
    });
    setActivos(updated);
    saveActivos(updated);
    toast.success(`Depreciación de ${meses[depMes]} ${depAnio} registrada: ${formatMoney(totalDep)}`);
  };

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Activos Fijos y Depreciación</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Register */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Building2 className="h-5 w-5" />Registrar Activo Fijo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Nombre</Label><Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Horno industrial" /></div>
            <div><Label>Descripción</Label><Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fecha de Adquisición</Label><Input type="date" value={fechaAdq} onChange={e => setFechaAdq(e.target.value)} /></div>
              <div><Label>Costo de Adquisición (Bs)</Label><Input type="number" value={costo} onChange={e => setCosto(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Vida Útil (años)</Label><Input type="number" value={vidaUtil} onChange={e => setVidaUtil(e.target.value)} min="1" /></div>
              <div>
                <Label>Categoría</Label>
                <Select value={cuentaActivoCode} onValueChange={setCuentaActivoCode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cuentasActivo.map(c => (
                      <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} - {c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cuenta de Pago</Label>
              <Select value={cuentaPagoId} onValueChange={setCuentaPagoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cuentasCajaBanco.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRegistrarActivo} className="w-full"><Plus className="h-4 w-4 mr-2" />Registrar Activo</Button>
          </CardContent>
        </Card>

        {/* Depreciation */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Calculator className="h-5 w-5" />Depreciación Mensual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Año</Label><Input type="number" value={depAnio} onChange={e => setDepAnio(parseInt(e.target.value) || 2025)} /></div>
              <div>
                <Label>Mes</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={depMes} onChange={e => setDepMes(parseInt(e.target.value))}>
                  {meses.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>

            {activos.length > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="font-semibold mb-2">Depreciación a registrar:</div>
                {activos.map(a => {
                  const mesesVida = a.vidaUtilAnios * 12;
                  const depMensual = a.costoAdquisicion / mesesVida;
                  const agotado = a.depreciacionesRegistradas >= mesesVida;
                  return (
                    <div key={a.id} className="flex justify-between">
                      <span className={agotado ? "line-through text-muted-foreground" : ""}>{a.nombre}</span>
                      <span>{agotado ? "Depreciado" : formatMoney(depMensual)}</span>
                    </div>
                  );
                })}
                <hr className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{formatMoney(activos.filter(a => a.depreciacionesRegistradas < a.vidaUtilAnios * 12).reduce((s, a) => s + a.costoAdquisicion / (a.vidaUtilAnios * 12), 0))}</span>
                </div>
              </div>
            )}

            <Button onClick={handleDepreciarMes} disabled={activos.length === 0} className="w-full">
              Registrar Depreciación del Mes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Activos table */}
      {activos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-display">Tabla de Activos Fijos</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activo</TableHead>
                    <TableHead>Fecha Adq.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Vida Útil</TableHead>
                    <TableHead className="text-right">Dep. Mensual</TableHead>
                    <TableHead className="text-right">Dep. Acumulada</TableHead>
                    <TableHead className="text-right">Valor en Libros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activos.map(a => {
                    const mesesVida = a.vidaUtilAnios * 12;
                    const depMensual = a.costoAdquisicion / mesesVida;
                    const depAcum = depMensual * a.depreciacionesRegistradas;
                    const valorLibros = a.costoAdquisicion - depAcum;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell>{new Date(a.fechaAdquisicion + 'T12:00:00').toLocaleDateString('es-BO')}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(a.costoAdquisicion)}</TableCell>
                        <TableCell className="text-right">{a.vidaUtilAnios} años</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(depMensual)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(depAcum)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatMoney(valorLibros)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
