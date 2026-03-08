import { useState, useMemo } from "react";
import { useAccounting } from "@/store/AccountingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/accounting";
import { Printer, FileText } from "lucide-react";

const STORAGE_KEY = 'panconta_notas_contables';

interface NotasData {
  empresaNombre: string;
  actividadEconomica: string;
  periodoContable: string;
  politicasContables: string;
  notaInventarios: string;
  notaActivosFijos: string;
  notaObligaciones: string;
  notaPatrimonio: string;
}

function loadNotas(): NotasData {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch {}
  return {
    empresaNombre: 'PanConta — Panadería Artesanal',
    actividadEconomica: 'Elaboración y venta de productos de panadería y pastelería',
    periodoContable: `Del 1 de enero al 31 de diciembre de ${new Date().getFullYear()}`,
    politicasContables: `Los estados financieros han sido preparados de conformidad con las Normas de Información Financiera para Pequeñas y Medianas Entidades (NB-NIIF para PYMES) adoptadas por Bolivia.

Inventarios: Los inventarios se valúan al Costo Promedio Ponderado (CPP) conforme a la Sección 13 de las NIIF para PYMES adoptadas por Bolivia mediante NB-NIIF. El costo incluye materias primas, mano de obra directa y costos indirectos de producción.

Activos Fijos: Los activos fijos se registran al costo de adquisición y se deprecian por el método de línea recta conforme a la Sección 17 de las NIIF para PYMES.

Reconocimiento de Ingresos: Los ingresos se reconocen cuando se transfieren los riesgos y beneficios significativos al comprador, conforme a la Sección 23 de las NIIF para PYMES.`,
    notaInventarios: '',
    notaActivosFijos: '',
    notaObligaciones: '',
    notaPatrimonio: '',
  };
}

function saveNotas(data: NotasData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function NotasContablesPage() {
  const {
    cuentas, comprobantes, detalles, insumos, stockInsumos, productos, stock,
    getComprobantesContabilizados, getDetallesContabilizados, getInsumo,
  } = useAccounting();

  const [notas, setNotas] = useState<NotasData>(loadNotas);

  const updateNota = (field: keyof NotasData, value: string) => {
    const updated = { ...notas, [field]: value };
    setNotas(updated);
    saveNotas(updated);
  };

  const contabComprobantes = getComprobantesContabilizados();
  const contabDetalles = getDetallesContabilizados();

  // Load activos fijos
  const activosFijos = useMemo(() => {
    try {
      const r = localStorage.getItem('panconta_activos_fijos');
      return r ? JSON.parse(r) : [];
    } catch { return []; }
  }, []);

  // Nota 3 — Inventarios
  const inventarioInsumos = useMemo(() => {
    return insumos
      .filter(i => i.activo && !i.deleted_at)
      .map(i => {
        const stk = stockInsumos.find(s => s.insumo_id === i.id);
        return {
          nombre: i.nombre,
          cantidad: stk?.cantidad_actual || 0,
          unidad: i.unidad_base,
          costoPromedio: stk?.costo_promedio || 0,
          valorTotal: stk?.valor_actual || 0,
        };
      })
      .filter(i => i.valorTotal > 0.01);
  }, [insumos, stockInsumos]);

  const inventarioProductos = useMemo(() => {
    return productos
      .filter(p => p.activo)
      .map(p => {
        const s = stock.find(st => st.producto_id === p.id);
        return {
          nombre: p.nombre,
          cantidad: s?.cantidad_actual || 0,
          costoPromedio: s?.costo_promedio || 0,
          valorTotal: s?.valor_actual || 0,
        };
      })
      .filter(i => i.valorTotal > 0.01);
  }, [productos, stock]);

  // Nota 5 — Obligaciones
  const obligaciones = useMemo(() => {
    const codigosPasivos = ['P1.1', 'P1.2', 'P1.3', 'P1.4', 'P1.5', 'P1.6', 'P1.7'];
    return codigosPasivos.map(codigo => {
      const cuenta = cuentas.find(c => c.codigo === codigo);
      if (!cuenta) return null;
      const ds = contabDetalles.filter(d => d.cuenta_id === cuenta.id);
      const saldo = ds.reduce((s, d) => s + d.haber - d.debe, 0);
      return { codigo, nombre: cuenta.nombre, saldo };
    }).filter(Boolean).filter((o: any) => Math.abs(o.saldo) > 0.01) as { codigo: string; nombre: string; saldo: number }[];
  }, [cuentas, contabDetalles]);

  // Nota 6 — Patrimonio
  const patrimonio = useMemo(() => {
    const codigosPatrimonio = ['C1.1', 'C1.2', 'C1.3'];
    return codigosPatrimonio.map(codigo => {
      const cuenta = cuentas.find(c => c.codigo === codigo);
      if (!cuenta) return null;
      const ds = contabDetalles.filter(d => d.cuenta_id === cuenta.id);
      // Patrimonio increases on HABER, C1.3 (retiros) increases on DEBE
      const saldo = codigo === 'C1.3'
        ? -(ds.reduce((s, d) => s + d.debe - d.haber, 0))
        : ds.reduce((s, d) => s + d.haber - d.debe, 0);
      return { codigo, nombre: cuenta.nombre, saldo };
    }).filter(Boolean) as { codigo: string; nombre: string; saldo: number }[];
  }, [cuentas, contabDetalles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-display font-bold">Notas a los Estados Financieros</h1>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />Imprimir Notas
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-lg font-bold">PanConta</h1>
        <h2 className="text-base">NOTAS A LOS ESTADOS FINANCIEROS</h2>
        <p className="text-sm">{notas.periodoContable}</p>
        <p className="text-xs text-muted-foreground">Expresado en Bolivianos (Bs)</p>
      </div>

      {/* Nota 1 */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 print:hidden" />
            Nota 1 — Información General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nombre de la empresa</Label>
            <Input value={notas.empresaNombre} onChange={e => updateNota('empresaNombre', e.target.value)} />
          </div>
          <div>
            <Label>Actividad económica</Label>
            <Input value={notas.actividadEconomica} onChange={e => updateNota('actividadEconomica', e.target.value)} />
          </div>
          <div>
            <Label>Período contable</Label>
            <Input value={notas.periodoContable} onChange={e => updateNota('periodoContable', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Nota 2 */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display">Nota 2 — Políticas Contables Significativas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notas.politicasContables}
            onChange={e => updateNota('politicasContables', e.target.value)}
            className="min-h-[200px] text-sm"
          />
        </CardContent>
      </Card>

      {/* Nota 3 */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display">Nota 3 — Inventarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {inventarioInsumos.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Inventario de Insumos (Materia Prima)</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">CPP</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventarioInsumos.map((i, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{i.nombre}</TableCell>
                        <TableCell className="text-right font-mono">{i.cantidad.toFixed(2)}</TableCell>
                        <TableCell>{i.unidad}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(i.costoPromedio)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(i.valorTotal)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={4}>Total Insumos</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(inventarioInsumos.reduce((s, i) => s + i.valorTotal, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {inventarioProductos.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Inventario de Producto Terminado</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">CPP</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventarioProductos.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{p.nombre}</TableCell>
                        <TableCell className="text-right font-mono">{p.cantidad}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(p.costoPromedio)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(p.valorTotal)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={3}>Total Productos</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(inventarioProductos.reduce((s, p) => s + p.valorTotal, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <Textarea
            value={notas.notaInventarios}
            onChange={e => updateNota('notaInventarios', e.target.value)}
            placeholder="Comentarios adicionales sobre inventarios..."
            className="min-h-[60px] text-sm"
          />
        </CardContent>
      </Card>

      {/* Nota 4 */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display">Nota 4 — Activos Fijos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activosFijos.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activo</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Vida Útil</TableHead>
                    <TableHead className="text-right">Dep. Acumulada</TableHead>
                    <TableHead className="text-right">Valor en Libros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activosFijos.map((a: any) => {
                    const depMensual = a.costoAdquisicion / (a.vidaUtilAnios * 12);
                    const depAcum = depMensual * a.depreciacionesRegistradas;
                    const valorLibros = a.costoAdquisicion - depAcum;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{a.nombre}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(a.costoAdquisicion)}</TableCell>
                        <TableCell className="text-right">{a.vidaUtilAnios} años</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(depAcum)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(valorLibros)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(activosFijos.reduce((s: number, a: any) => s + a.costoAdquisicion, 0))}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(activosFijos.reduce((s: number, a: any) => s + (a.costoAdquisicion / (a.vidaUtilAnios * 12)) * a.depreciacionesRegistradas, 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(activosFijos.reduce((s: number, a: any) => s + a.costoAdquisicion - (a.costoAdquisicion / (a.vidaUtilAnios * 12)) * a.depreciacionesRegistradas, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay activos fijos registrados.</p>
          )}

          <Textarea
            value={notas.notaActivosFijos}
            onChange={e => updateNota('notaActivosFijos', e.target.value)}
            placeholder="Comentarios adicionales sobre activos fijos..."
            className="min-h-[60px] text-sm"
          />
        </CardContent>
      </Card>

      {/* Nota 5 */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display">Nota 5 — Obligaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {obligaciones.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obligaciones.map(o => (
                    <TableRow key={o.codigo}>
                      <TableCell>{o.codigo}</TableCell>
                      <TableCell>{o.nombre}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(o.saldo)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Total Obligaciones</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(obligaciones.reduce((s, o) => s + o.saldo, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay obligaciones pendientes registradas.</p>
          )}

          <Textarea
            value={notas.notaObligaciones}
            onChange={e => updateNota('notaObligaciones', e.target.value)}
            placeholder="Comentarios adicionales sobre obligaciones..."
            className="min-h-[60px] text-sm"
          />
        </CardContent>
      </Card>

      {/* Nota 6 */}
      <Card className="print-section">
        <CardHeader>
          <CardTitle className="font-display">Nota 6 — Patrimonio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patrimonio.map(p => (
                  <TableRow key={p.codigo}>
                    <TableCell>{p.codigo}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(p.saldo)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Total Patrimonio</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(patrimonio.reduce((s, p) => s + p.saldo, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <Textarea
            value={notas.notaPatrimonio}
            onChange={e => updateNota('notaPatrimonio', e.target.value)}
            placeholder="Comentarios adicionales sobre patrimonio..."
            className="min-h-[60px] text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}
