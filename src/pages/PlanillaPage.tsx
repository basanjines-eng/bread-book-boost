import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Users, FileText, Eye } from "lucide-react";
import { formatMoney, today } from "@/lib/accounting";

interface Empleado {
  id: string;
  nombre: string;
  cargo: string;
  sueldoBase: number;
}

interface PlanillaRegistro {
  id: string;
  anio: number;
  mes: number;
  fecha: string;
  empleados: {
    empleadoId: string;
    nombre: string;
    cargo: string;
    sueldoBruto: number;
    descuentoAFP: number;    // 10% empleado
    sueldoNeto: number;
    aporteAFPPatronal: number;  // 3%
    aporteCNS: number;          // 10%
    aporteProVivienda: number;  // 2%
  }[];
  comprobanteId: string;
}

const STORAGE_KEY_EMPLEADOS = 'panconta_empleados';
const STORAGE_KEY_PLANILLAS = 'panconta_planillas';

function loadEmpleados(): Empleado[] {
  try { const r = localStorage.getItem(STORAGE_KEY_EMPLEADOS); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveEmpleados(e: Empleado[]) { localStorage.setItem(STORAGE_KEY_EMPLEADOS, JSON.stringify(e)); }
function loadPlanillas(): PlanillaRegistro[] {
  try { const r = localStorage.getItem(STORAGE_KEY_PLANILLAS); return r ? JSON.parse(r) : []; } catch { return []; }
}
function savePlanillas(p: PlanillaRegistro[]) { localStorage.setItem(STORAGE_KEY_PLANILLAS, JSON.stringify(p)); }

export default function PlanillaPage() {
  const { addComprobante, contabilizar, isMesCerrado, getCuentaByCodigo } = useAccounting();

  const [empleados, setEmpleados] = useState<Empleado[]>(loadEmpleados);
  const [planillas, setPlanillas] = useState<PlanillaRegistro[]>(loadPlanillas);

  // Empleado form
  const [empNombre, setEmpNombre] = useState("");
  const [empCargo, setEmpCargo] = useState("");
  const [empSueldo, setEmpSueldo] = useState("");

  // Planilla form
  const [planAnio, setPlanAnio] = useState(new Date().getFullYear());
  const [planMes, setPlanMes] = useState(new Date().getMonth() + 1);

  // Detail dialog
  const [detailPlanilla, setDetailPlanilla] = useState<PlanillaRegistro | null>(null);

  const handleAddEmpleado = () => {
    if (!empNombre.trim()) { toast.error("Ingrese nombre del empleado"); return; }
    if (!empCargo.trim()) { toast.error("Ingrese cargo"); return; }
    const sueldo = parseFloat(empSueldo);
    if (!sueldo || sueldo <= 0) { toast.error("Ingrese sueldo válido"); return; }
    const newEmp: Empleado = { id: crypto.randomUUID(), nombre: empNombre, cargo: empCargo, sueldoBase: sueldo };
    const updated = [...empleados, newEmp];
    setEmpleados(updated);
    saveEmpleados(updated);
    setEmpNombre(""); setEmpCargo(""); setEmpSueldo("");
    toast.success("Empleado registrado");
  };

  const handleDeleteEmpleado = (id: string) => {
    const updated = empleados.filter(e => e.id !== id);
    setEmpleados(updated);
    saveEmpleados(updated);
    toast.success("Empleado eliminado");
  };

  const mesYaRegistrado = useMemo(() =>
    planillas.some(p => p.anio === planAnio && p.mes === planMes),
    [planillas, planAnio, planMes]
  );

  const handleRegistrarPlanilla = () => {
    if (empleados.length === 0) { toast.error("No hay empleados registrados"); return; }
    const fechaRef = `${planAnio}-${String(planMes).padStart(2, '0')}-28`;
    if (isMesCerrado(fechaRef)) { toast.error("El mes está cerrado"); return; }
    if (mesYaRegistrado) { toast.error("Ya existe planilla para este mes"); return; }

    const cSueldos = getCuentaByCodigo('G1.9');
    const cAportesP = getCuentaByCodigo('G1.10');
    const cSueldosPP = getCuentaByCodigo('P1.5');
    const cAFPPP = getCuentaByCodigo('P1.6');
    const cCNSPP = getCuentaByCodigo('P1.7');
    if (!cSueldos || !cAportesP || !cSueldosPP || !cAFPPP || !cCNSPP) {
      toast.error("Faltan cuentas contables de planilla"); return;
    }

    const emps = empleados.map(e => {
      const bruto = e.sueldoBase;
      const descAFP = bruto * 0.10;
      const neto = bruto - descAFP;
      const afpPatronal = bruto * 0.03;
      const cns = bruto * 0.10;
      const proVivienda = bruto * 0.02;
      return {
        empleadoId: e.id, nombre: e.nombre, cargo: e.cargo,
        sueldoBruto: bruto, descuentoAFP: descAFP, sueldoNeto: neto,
        aporteAFPPatronal: afpPatronal, aporteCNS: cns, aporteProVivienda: proVivienda,
      };
    });

    const totalBruto = emps.reduce((s, e) => s + e.sueldoBruto, 0);
    const totalNeto = emps.reduce((s, e) => s + e.sueldoNeto, 0);
    const totalDescAFP = emps.reduce((s, e) => s + e.descuentoAFP, 0);
    const totalAFPPatronal = emps.reduce((s, e) => s + e.aporteAFPPatronal, 0);
    const totalCNS = emps.reduce((s, e) => s + e.aporteCNS, 0);
    const totalProVivienda = emps.reduce((s, e) => s + e.aporteProVivienda, 0);
    const totalAportesPatronales = totalAFPPatronal + totalCNS + totalProVivienda;

    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const glosa = `Planilla de sueldos — ${meses[planMes]} ${planAnio}`;

    const compId = addComprobante(
      { fecha: fechaRef, glosa, estado: 'BORRADOR' },
      [
        { cuenta_id: cSueldos.id, descripcion: `Sueldos brutos ${meses[planMes]}`, debe: totalBruto, haber: 0 },
        { cuenta_id: cAportesP.id, descripcion: `Aportes patronales ${meses[planMes]}`, debe: totalAportesPatronales, haber: 0 },
        { cuenta_id: cSueldosPP.id, descripcion: `Sueldos netos por pagar`, debe: 0, haber: totalNeto },
        { cuenta_id: cAFPPP.id, descripcion: `AFP empleado + patronal`, debe: 0, haber: totalDescAFP + totalAFPPatronal },
        { cuenta_id: cCNSPP.id, descripcion: `CNS + Pro-Vivienda`, debe: 0, haber: totalCNS + totalProVivienda },
      ]
    );
    contabilizar(compId);

    const registro: PlanillaRegistro = {
      id: crypto.randomUUID(), anio: planAnio, mes: planMes,
      fecha: fechaRef, empleados: emps, comprobanteId: compId,
    };
    const updated = [...planillas, registro];
    setPlanillas(updated);
    savePlanillas(updated);
    toast.success(`Planilla de ${meses[planMes]} ${planAnio} registrada`);
  };

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Planilla de Sueldos</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Empleados */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Users className="h-5 w-5" />Empleados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 items-end">
              <div><Label>Nombre</Label><Input value={empNombre} onChange={e => setEmpNombre(e.target.value)} placeholder="Nombre" /></div>
              <div><Label>Cargo</Label><Input value={empCargo} onChange={e => setEmpCargo(e.target.value)} placeholder="Cargo" /></div>
              <div><Label>Sueldo Base (Bs)</Label><Input type="number" value={empSueldo} onChange={e => setEmpSueldo(e.target.value)} placeholder="0.00" /></div>
            </div>
            <Button onClick={handleAddEmpleado} size="sm"><Plus className="h-4 w-4 mr-1" />Agregar</Button>

            {empleados.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Sueldo</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empleados.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>{e.nombre}</TableCell>
                        <TableCell>{e.cargo}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(e.sueldoBase)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteEmpleado(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registrar Planilla */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><FileText className="h-5 w-5" />Registrar Planilla Mensual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Año</Label><Input type="number" value={planAnio} onChange={e => setPlanAnio(parseInt(e.target.value) || 2025)} /></div>
              <div>
                <Label>Mes</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={planMes} onChange={e => setPlanMes(parseInt(e.target.value))}>
                  {meses.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>

            {empleados.length > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="font-semibold mb-2">Resumen de planilla:</div>
                {empleados.map(e => {
                  const afpEmp = e.sueldoBase * 0.10;
                  return (
                    <div key={e.id} className="flex justify-between">
                      <span>{e.nombre}</span>
                      <span>Bruto: {formatMoney(e.sueldoBase)} → Neto: {formatMoney(e.sueldoBase - afpEmp)}</span>
                    </div>
                  );
                })}
                <hr className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total Bruto:</span><span>{formatMoney(empleados.reduce((s, e) => s + e.sueldoBase, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>AFP Empleado (10%):</span><span>{formatMoney(empleados.reduce((s, e) => s + e.sueldoBase * 0.10, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>AFP Patronal (3%):</span><span>{formatMoney(empleados.reduce((s, e) => s + e.sueldoBase * 0.03, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>CNS Patronal (10%):</span><span>{formatMoney(empleados.reduce((s, e) => s + e.sueldoBase * 0.10, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pro-Vivienda (2%):</span><span>{formatMoney(empleados.reduce((s, e) => s + e.sueldoBase * 0.02, 0))}</span>
                </div>
              </div>
            )}

            <Button onClick={handleRegistrarPlanilla} disabled={mesYaRegistrado || empleados.length === 0} className="w-full">
              {mesYaRegistrado ? "Planilla ya registrada" : "Registrar Planilla del Mes"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Historial */}
      {planillas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-display">Historial de Planillas</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Total Bruto</TableHead>
                    <TableHead className="text-right">Total Neto</TableHead>
                    <TableHead className="text-right">Aportes Patronales</TableHead>
                    <TableHead className="text-center">Empleados</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...planillas].reverse().map(p => {
                    const bruto = p.empleados.reduce((s, e) => s + e.sueldoBruto, 0);
                    const neto = p.empleados.reduce((s, e) => s + e.sueldoNeto, 0);
                    const aportes = p.empleados.reduce((s, e) => s + e.aporteAFPPatronal + e.aporteCNS + e.aporteProVivienda, 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{meses[p.mes]} {p.anio}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(bruto)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(neto)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(aportes)}</TableCell>
                        <TableCell className="text-center">{p.empleados.length}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setDetailPlanilla(p)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailPlanilla} onOpenChange={open => !open && setDetailPlanilla(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle Planilla — {detailPlanilla && `${meses[detailPlanilla.mes]} ${detailPlanilla.anio}`}</DialogTitle>
          </DialogHeader>
          {detailPlanilla && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">AFP (10%)</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailPlanilla.empleados.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.nombre}</TableCell>
                      <TableCell>{e.cargo}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(e.sueldoBruto)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(e.descuentoAFP)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(e.sueldoNeto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailPlanilla(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
