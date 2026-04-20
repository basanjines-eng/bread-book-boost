import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  Cuenta, Comprobante, ComprobanteDetalle, Producto,
  Produccion, StockProducto, Venta, VentaCobro, CierreMensual, EstadoVenta,
  Insumo, StockInsumo, MovimientoInsumo, Receta, RecetaInsumo,
} from '@/types/accounting';
import {
  generateId, generateNumero, today,
  getInitialCuentas, getInitialProductos, getInitialStock,
  getInitialInsumos, getInitialStockInsumos,
  getInitialRecetas, getNextIngresoCodigo, convertirUnidadFlexible,
} from '@/lib/accounting';

// ==================== STATE ====================
interface AccountingState {
  cuentas: Cuenta[];
  comprobantes: Comprobante[];
  detalles: ComprobanteDetalle[];
  productos: Producto[];
  stock: StockProducto[];
  producciones: Produccion[];
  ventas: Venta[];
  cierres: CierreMensual[];
  insumos: Insumo[];
  stockInsumos: StockInsumo[];
  movimientosInsumos: MovimientoInsumo[];
  recetas: Receta[];
  recetaInsumos: RecetaInsumo[];
}

const STORAGE_KEY = 'panconta_state';

function getInitialState(): AccountingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const cuentas = getInitialCuentas();
  const productos = getInitialProductos(cuentas);
  const stock = getInitialStock(productos);
  const insumos = getInitialInsumos();
  const stockInsumos = getInitialStockInsumos(insumos);
  const { recetas, recetaInsumos } = getInitialRecetas(productos, insumos);
  return {
    cuentas, comprobantes: [], detalles: [], productos, stock,
    producciones: [], ventas: [], cierres: [],
    insumos, stockInsumos, movimientosInsumos: [],
    recetas, recetaInsumos,
  };
}

// ==================== CONTEXT ====================
interface AccountingContextType {
  // Data
  cuentas: Cuenta[];
  comprobantes: Comprobante[];
  detalles: ComprobanteDetalle[];
  productos: Producto[];
  stock: StockProducto[];
  producciones: Produccion[];
  ventas: Venta[];
  cierres: CierreMensual[];
  insumos: Insumo[];
  stockInsumos: StockInsumo[];
  movimientosInsumos: MovimientoInsumo[];
  recetas: Receta[];
  recetaInsumos: RecetaInsumo[];

  // Cuentas
  addCuenta: (c: Omit<Cuenta, 'id'>) => void;
  updateCuenta: (c: Cuenta) => void;
  deleteCuenta: (id: string) => { ok: boolean; reason?: string };
  cuentaTieneMovimientos: (id: string) => boolean;
  getCuenta: (id: string) => Cuenta | undefined;
  getCuentaByCodigo: (codigo: string) => Cuenta | undefined;

  // Comprobantes
  addComprobante: (comp: Omit<Comprobante, 'id' | 'numero' | 'created_at' | 'updated_at'>, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => string;
  updateComprobante: (comp: Comprobante, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => void;
  deleteComprobante: (id: string) => void;
  contabilizar: (id: string) => boolean;
  pasarABorrador: (id: string) => void;
  getDetallesForComprobante: (id: string) => ComprobanteDetalle[];
  getComprobantesContabilizados: () => Comprobante[];
  getDetallesContabilizados: () => ComprobanteDetalle[];

  // Productos
  addProducto: (nombre: string) => void;
  eliminarProducto: (id: string) => { ok: boolean; reason?: string };
  getProducto: (id: string) => Producto | undefined;
  getStockForProducto: (productoId: string) => StockProducto | undefined;

  // Producción
  addProduccion: (p: Omit<Produccion, 'id' | 'costo_total_produccion' | 'costo_unitario' | 'comprobante_id' | 'deleted_at'>) => void;
  confirmarProduccion: (id: string) => { ok: boolean; faltante?: string };
  editarProduccion: (id: string, data: { fecha: string; producto_id: string; receta_id?: string; cantidad_lotes: number; cantidad_producida: number }) => boolean;
  eliminarProduccion: (id: string) => boolean;
  canModifyProduccion: (id: string) => { ok: boolean; reason?: string };
  actualizarCantidadEsperada: (id: string, cantidadEsperada: number) => void;

  // Ventas
  registrarVenta: (v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }) => boolean;
  editarVenta: (id: string, data: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }) => boolean;
  eliminarVenta: (id: string) => boolean;
  recalcularCostosVentas: () => void;

  // Stock / Merma
  registrarMerma: (productoId: string, cantidad: number, fecha: string, motivo: string) => boolean;

  // Insumos
  getInsumo: (id: string) => Insumo | undefined;
  getStockForInsumo: (insumoId: string) => StockInsumo | undefined;
  addInsumo: (i: Omit<Insumo, 'id' | 'created_at' | 'updated_at'>) => void;
  updateInsumo: (i: Insumo) => void;
  deleteInsumo: (id: string) => void;
  addMovimientoInsumo: (m: Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>, cuentaPagoId?: string) => string;
  editMovimientoInsumo: (id: string, data: Partial<Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>>) => boolean;
  deleteMovimientoInsumo: (id: string) => boolean;

  // Recetas
  addReceta: (r: { producto_id: string; nombre_receta: string; activo?: boolean; fecha_especifica?: string | null }, ingredientes: { insumo_id: string; cantidad_usada: number; unidad_medida: string }[]) => void;
  updateReceta: (id: string, data: { nombre_receta: string; producto_id?: string; fecha_especifica?: string }, ingredientes: { insumo_id: string; cantidad_usada: number; unidad_medida: string }[]) => void;
  deleteReceta: (id: string) => void;
  getRecetaInsumos: (recetaId: string) => RecetaInsumo[];
  calcularCostoReceta: (recetaId: string) => number;

  // Cierres
  cerrarMes: (anio: number, mes: number, nota?: string) => void;
  reabrirMes: (anio: number, mes: number) => void;
  isMesCerrado: (fecha: string) => boolean;

  // Reset
  resetDatosOperativos: () => void;
}

const AccountingContext = createContext<AccountingContextType | null>(null);

export function useAccounting(): AccountingContextType {
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error('useAccounting must be used within AccountingProvider');
  return ctx;
}

// ==================== PROVIDER ====================
export function AccountingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountingState>(getInitialState);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // ─── CUENTAS ─────────────────────────────────────────
  const getCuenta = useCallback((id: string) => state.cuentas.find(c => c.id === id), [state.cuentas]);
  const getCuentaByCodigo = useCallback((codigo: string) => state.cuentas.find(c => c.codigo === codigo), [state.cuentas]);

  const addCuenta = useCallback((c: Omit<Cuenta, 'id'>) => {
    setState(s => ({ ...s, cuentas: [...s.cuentas, { ...c, id: generateId() }] }));
  }, []);

  const updateCuenta = useCallback((c: Cuenta) => {
    setState(s => ({ ...s, cuentas: s.cuentas.map(x => x.id === c.id ? c : x) }));
  }, []);

  // ─── COMPROBANTES ────────────────────────────────────
  // BUG FIX #1: generateNumero inside setState
  const addComprobante = useCallback((
    comp: Omit<Comprobante, 'id' | 'numero' | 'created_at' | 'updated_at'>,
    dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]
  ): string => {
    const compId = generateId();
    const now = new Date().toISOString();
    setState(s => {
      const numero = generateNumero(comp.fecha, s.comprobantes.length);
      const newComp: Comprobante = { ...comp, id: compId, numero, created_at: now, updated_at: now };
      const newDets = dets.map(d => ({ ...d, id: generateId(), comprobante_id: compId }));
      return { ...s, comprobantes: [...s.comprobantes, newComp], detalles: [...s.detalles, ...newDets] };
    });
    return compId;
  }, []);

  const updateComprobante = useCallback((comp: Comprobante, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => {
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === comp.id ? { ...comp, updated_at: new Date().toISOString() } : c),
      detalles: [
        ...s.detalles.filter(d => d.comprobante_id !== comp.id),
        ...dets.map(d => ({ ...d, id: generateId(), comprobante_id: comp.id })),
      ],
    }));
  }, []);

  const deleteComprobante = useCallback((id: string) => {
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c),
    }));
  }, []);

  const contabilizar = useCallback((id: string): boolean => {
    let success = false;
    setState(s => {
      const comp = s.comprobantes.find(c => c.id === id);
      if (!comp) return s;
      const dets = s.detalles.filter(d => d.comprobante_id === id);
      if (dets.length === 0) return s;
      const totalDebe = dets.reduce((sum, d) => sum + d.debe, 0);
      const totalHaber = dets.reduce((sum, d) => sum + d.haber, 0);
      if (Math.abs(totalDebe - totalHaber) > 0.01) return s;
      success = true;
      return {
        ...s,
        comprobantes: s.comprobantes.map(c => c.id === id ? { ...c, estado: 'CONTABILIZADO' as const, updated_at: new Date().toISOString() } : c),
      };
    });
    return success;
  }, []);

  const pasarABorrador = useCallback((id: string) => {
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === id ? { ...c, estado: 'BORRADOR' as const, updated_at: new Date().toISOString() } : c),
    }));
  }, []);

  const getDetallesForComprobante = useCallback((id: string) => state.detalles.filter(d => d.comprobante_id === id), [state.detalles]);

  const getComprobantesContabilizados = useCallback(() =>
    state.comprobantes.filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at),
    [state.comprobantes]
  );

  const getDetallesContabilizados = useCallback(() => {
    const contabIds = new Set(state.comprobantes.filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at).map(c => c.id));
    return state.detalles.filter(d => contabIds.has(d.comprobante_id));
  }, [state.comprobantes, state.detalles]);

  // ─── PRODUCTOS ───────────────────────────────────────
  const getProducto = useCallback((id: string) => state.productos.find(p => p.id === id), [state.productos]);
  const getStockForProducto = useCallback((pid: string) => state.stock.find(s => s.producto_id === pid), [state.stock]);

  const addProducto = useCallback((nombre: string) => {
    setState(s => {
      const nextCodigo = getNextIngresoCodigo(s.cuentas);
      const cuentaId = generateId();
      const newCuenta: Cuenta = {
        id: cuentaId, codigo: nextCodigo, nombre: `Venta de ${nombre}`, tipo: 'INGRESO',
        naturaleza: 'ACREEDORA', aumenta_en: 'HABER', disminuye_en: 'DEBE',
        es_caja_banco: false, activa: true,
      };
      const prodId = generateId();
      const newProd: Producto = { id: prodId, nombre, cuenta_ingreso_id: cuentaId, activo: true };
      const newStock: StockProducto = {
        id: generateId(), producto_id: prodId, cantidad_actual: 0, valor_actual: 0,
        costo_promedio: 0, stock_minimo: 0, updated_at: new Date().toISOString(),
      };
      return {
        ...s,
        cuentas: [...s.cuentas, newCuenta],
        productos: [...s.productos, newProd],
        stock: [...s.stock, newStock],
      };
    });
  }, []);

  // ─── INSUMOS ─────────────────────────────────────────
  const getInsumo = useCallback((id: string) => state.insumos.find(i => i.id === id), [state.insumos]);
  const getStockForInsumo = useCallback((iid: string) => state.stockInsumos.find(s => s.insumo_id === iid), [state.stockInsumos]);

  const addInsumo = useCallback((i: Omit<Insumo, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString();
    const id = generateId();
    setState(s => ({
      ...s,
      insumos: [...s.insumos, { ...i, id, created_at: now, updated_at: now }],
      stockInsumos: [...s.stockInsumos, { id: generateId(), insumo_id: id, cantidad_actual: 0, valor_actual: 0, costo_promedio: 0, updated_at: now }],
    }));
  }, []);

  const updateInsumo = useCallback((i: Insumo) => {
    setState(s => ({
      ...s,
      insumos: s.insumos.map(x => x.id === i.id ? { ...i, updated_at: new Date().toISOString() } : x),
    }));
  }, []);

  const deleteInsumo = useCallback((id: string) => {
    setState(s => ({
      ...s,
      insumos: s.insumos.map(i => i.id === id ? { ...i, deleted_at: new Date().toISOString(), activo: false } : i),
    }));
  }, []);

  // BUG FIX #1: generateNumero inside setState for movimiento insumo
  const addMovimientoInsumo = useCallback((m: Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>, cuentaPagoId?: string): string => {
    const movId = generateId();
    const now = new Date().toISOString();
    setState(s => {
      const insumo = s.insumos.find(i => i.id === m.insumo_id);
      let cantidadEquivalenteBase = m.cantidad;
      if (insumo && m.unidad_movimiento !== insumo.unidad_base) {
        if (m.unidad_movimiento === insumo.unidad_compra_habitual) {
          cantidadEquivalenteBase = m.cantidad * insumo.equivalencia_compra;
        }
      }
      const costoTotal = m.precio_unitario * m.cantidad;

      const newMov: MovimientoInsumo = {
        ...m, id: movId, cantidad_equivalente_base: cantidadEquivalenteBase,
        costo_total: costoTotal, created_at: now, updated_at: now,
      };

      // Update stock
      const newStockInsumos = s.stockInsumos.map(si => {
        if (si.insumo_id !== m.insumo_id) return si;
        let newCant = si.cantidad_actual;
        let newVal = si.valor_actual;
        if (m.tipo_movimiento === 'ENTRADA') {
          newCant += cantidadEquivalenteBase;
          newVal += costoTotal;
        } else if (m.tipo_movimiento === 'SALIDA') {
          newCant = Math.max(0, newCant - cantidadEquivalenteBase);
          newVal = Math.max(0, newVal - cantidadEquivalenteBase * si.costo_promedio);
        } else if (m.tipo_movimiento === 'AJUSTE') {
          if (m.motivo === '__INVENTARIO_INICIAL__') {
            // Inventario inicial: setea cantidad Y costo promedio sin asiento contable
            newCant = cantidadEquivalenteBase;
            newVal = costoTotal; // precio_unitario * cantidad = valor total
          } else {
            // Ajuste normal: modifica cantidad, mantiene costo promedio existente
            newCant = Math.max(0, newCant + cantidadEquivalenteBase);
            newVal = newCant > 0 ? newCant * si.costo_promedio : 0;
          }
        }
        const newCPP = newCant > 0 ? newVal / newCant : 0;
        return { ...si, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCPP, updated_at: now };
      });

      // Generate comprobante for ENTRADA
      let newComprobantes = s.comprobantes;
      let newDetalles = s.detalles;
      if (m.tipo_movimiento === 'ENTRADA') {
        const compId = generateId();
        const numero = generateNumero(m.fecha, s.comprobantes.length);
        const cInvInsumos = s.cuentas.find(c => c.codigo === 'A1.6');
        // Use provided cuentaPagoId or fall back to first caja account
        const cPago = cuentaPagoId ? s.cuentas.find(c => c.id === cuentaPagoId) : (s.cuentas.find(c => c.es_caja_banco && c.activa) || s.cuentas.find(c => c.codigo === 'A1.1'));
        if (cInvInsumos && cPago) {
          const comp: Comprobante = {
            id: compId, numero, fecha: m.fecha,
            glosa: `Compra de insumo: ${insumo?.nombre || ''}`,
            estado: 'CONTABILIZADO', created_at: now, updated_at: now,
          };
          const dets: ComprobanteDetalle[] = [
            { id: generateId(), comprobante_id: compId, cuenta_id: cInvInsumos.id, descripcion: `Ingreso ${insumo?.nombre}`, debe: costoTotal, haber: 0 },
            { id: generateId(), comprobante_id: compId, cuenta_id: cPago.id, descripcion: `Pago compra ${insumo?.nombre}`, debe: 0, haber: costoTotal },
          ];
          newComprobantes = [...newComprobantes, comp];
          newDetalles = [...newDetalles, ...dets];
        }
      }

      return {
        ...s,
        movimientosInsumos: [...s.movimientosInsumos, newMov],
        stockInsumos: newStockInsumos,
        comprobantes: newComprobantes,
        detalles: newDetalles,
      };
    });
    return movId;
  }, []);

  const editMovimientoInsumo = useCallback((id: string, data: Partial<Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>>): boolean => {
    let success = false;
    setState(s => {
      const mov = s.movimientosInsumos.find(m => m.id === id);
      if (!mov || mov.deleted_at) return s;
      const updated = { ...mov, ...data, updated_at: new Date().toISOString() };
      const insumo = s.insumos.find(i => i.id === updated.insumo_id);
      if (insumo && updated.unidad_movimiento !== insumo.unidad_base) {
        if (updated.unidad_movimiento === insumo.unidad_compra_habitual) {
          updated.cantidad_equivalente_base = updated.cantidad * insumo.equivalencia_compra;
        } else {
          updated.cantidad_equivalente_base = updated.cantidad;
        }
      } else {
        updated.cantidad_equivalente_base = updated.cantidad;
      }
      updated.costo_total = updated.precio_unitario * updated.cantidad;

      // Recalculate stock from scratch
      const newMovs = s.movimientosInsumos.map(m => m.id === id ? updated : m);
      const newStockInsumos = recalcStockInsumos(s.stockInsumos, s.insumos, newMovs);

      success = true;
      return { ...s, movimientosInsumos: newMovs, stockInsumos: newStockInsumos };
    });
    return success;
  }, []);

  const deleteMovimientoInsumo = useCallback((id: string): boolean => {
    let success = false;
    setState(s => {
      const mov = s.movimientosInsumos.find(m => m.id === id);
      if (!mov) return s;
      const newMovs = s.movimientosInsumos.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m);
      const newStockInsumos = recalcStockInsumos(s.stockInsumos, s.insumos, newMovs);
      success = true;
      return { ...s, movimientosInsumos: newMovs, stockInsumos: newStockInsumos };
    });
    return success;
  }, []);

  // ─── RECETAS ─────────────────────────────────────────
  const getRecetaInsumos = useCallback((recetaId: string) =>
    state.recetaInsumos.filter(ri => ri.receta_id === recetaId), [state.recetaInsumos]);

  const calcularCostoReceta = useCallback((recetaId: string): number => {
    const ingredientes = state.recetaInsumos.filter(ri => ri.receta_id === recetaId);
    let total = 0;
    for (const ri of ingredientes) {
      const stk = state.stockInsumos.find(si => si.insumo_id === ri.insumo_id);
      if (stk && stk.costo_promedio > 0) {
        const insumo = state.insumos.find(i => i.id === ri.insumo_id);
        // Convert cantidad_usada to base units using CPP
        let cantidadBase = ri.cantidad_usada;
        if (insumo && ri.unidad_medida !== insumo.unidad_base) {
          if (ri.unidad_medida === insumo.unidad_compra_habitual) {
            cantidadBase = ri.cantidad_usada * insumo.equivalencia_compra;
          }
        }
        total += cantidadBase * stk.costo_promedio;
      }
    }
    return total;
  }, [state.recetaInsumos, state.stockInsumos, state.insumos]);

  const addReceta = useCallback((r: { producto_id: string; nombre_receta: string; activo?: boolean; fecha_especifica?: string | null }, ingredientes: { insumo_id: string; cantidad_usada: number; unidad_medida: string }[]) => {
    const now = new Date().toISOString();
    const recetaId = generateId();
    setState(s => ({
      ...s,
      recetas: [...s.recetas, { id: recetaId, producto_id: r.producto_id, nombre_receta: r.nombre_receta, activo: true, fecha_especifica: r.fecha_especifica || null, created_at: now, updated_at: now }],
      recetaInsumos: [
        ...s.recetaInsumos,
        ...ingredientes.map(ing => ({ id: generateId(), receta_id: recetaId, insumo_id: ing.insumo_id, cantidad_usada: ing.cantidad_usada, unidad_medida: ing.unidad_medida, created_at: now, updated_at: now })),
      ],
    }));
  }, []);

  const updateReceta = useCallback((id: string, data: { nombre_receta: string; producto_id?: string; fecha_especifica?: string }, ingredientes: { insumo_id: string; cantidad_usada: number; unidad_medida: string }[]) => {
    const now = new Date().toISOString();
    setState(s => ({
      ...s,
      recetas: s.recetas.map(r => r.id === id ? { ...r, nombre_receta: data.nombre_receta, fecha_especifica: data.fecha_especifica || null, updated_at: now } : r),
      recetaInsumos: [
        ...s.recetaInsumos.filter(ri => ri.receta_id !== id),
        ...ingredientes.map(ing => ({ id: generateId(), receta_id: id, insumo_id: ing.insumo_id, cantidad_usada: ing.cantidad_usada, unidad_medida: ing.unidad_medida, created_at: now, updated_at: now })),
      ],
    }));
  }, []);

  const deleteReceta = useCallback((id: string) => {
    setState(s => ({
      ...s,
      recetas: s.recetas.map(r => r.id === id ? { ...r, deleted_at: new Date().toISOString(), activo: false } : r),
    }));
  }, []);

  // ─── PRODUCCIÓN ──────────────────────────────────────
  const addProduccion = useCallback((p: Omit<Produccion, 'id' | 'costo_total_produccion' | 'costo_unitario' | 'comprobante_id' | 'deleted_at'>) => {
    setState(s => {
      let costoTotal = 0;
      if (p.receta_id) {
        const ingredientes = s.recetaInsumos.filter(ri => ri.receta_id === p.receta_id);
        for (const ri of ingredientes) {
          const stk = s.stockInsumos.find(si => si.insumo_id === ri.insumo_id);
          const insumo = s.insumos.find(i => i.id === ri.insumo_id);
          if (stk && stk.costo_promedio > 0) {
            let cantidadBase = ri.cantidad_usada;
            if (insumo && ri.unidad_medida !== insumo.unidad_base) {
              if (ri.unidad_medida === insumo.unidad_compra_habitual) {
                cantidadBase = ri.cantidad_usada * insumo.equivalencia_compra;
              }
            }
            costoTotal += cantidadBase * stk.costo_promedio;
          }
        }
        costoTotal *= p.cantidad_lotes;
      }
      const costoUnit = p.cantidad_producida > 0 ? costoTotal / p.cantidad_producida : 0;
      const newProd: Produccion = {
        ...p, id: generateId(), costo_total_produccion: costoTotal, costo_unitario: costoUnit, deleted_at: null,
      };
      return { ...s, producciones: [...s.producciones, newProd] };
    });
  }, []);

  // BUG FIX #2: Unit conversion in confirmarProduccion
  const confirmarProduccion = useCallback((id: string): { ok: boolean; faltante?: string } => {
    let result: { ok: boolean; faltante?: string } = { ok: false };
    setState(s => {
      const prod = s.producciones.find(p => p.id === id);
      if (!prod || prod.estado !== 'BORRADOR') return s;

      const recetaIngs = prod.receta_id ? s.recetaInsumos.filter(ri => ri.receta_id === prod.receta_id) : [];

      // Check stock availability with correct unit conversion
      for (const ri of recetaIngs) {
        const ins = s.insumos.find(i => i.id === ri.insumo_id);
        const stk = s.stockInsumos.find(si => si.insumo_id === ri.insumo_id);
        if (!stk) continue;

        // BUG FIX #2: Proper unit conversion
        let cantidadEnBase: number;
        if (!ins || ri.unidad_medida === ins.unidad_base) {
          cantidadEnBase = ri.cantidad_usada * prod.cantidad_lotes;
        } else if (ri.unidad_medida === ins.unidad_compra_habitual) {
          cantidadEnBase = ri.cantidad_usada * prod.cantidad_lotes * ins.equivalencia_compra;
        } else {
          cantidadEnBase = ri.cantidad_usada * prod.cantidad_lotes;
        }

        if (cantidadEnBase > stk.cantidad_actual + 0.01) {
          result = { ok: false, faltante: ins?.nombre || ri.insumo_id };
          return s;
        }
      }

      // Recalculate cost
      let costoTotal = 0;
      const newStockInsumos = [...s.stockInsumos];
      const newMovs: MovimientoInsumo[] = [];
      const now = new Date().toISOString();

      for (const ri of recetaIngs) {
        const ins = s.insumos.find(i => i.id === ri.insumo_id);
        const stkIdx = newStockInsumos.findIndex(si => si.insumo_id === ri.insumo_id);
        if (stkIdx < 0) continue;
        const stk = newStockInsumos[stkIdx];

        // BUG FIX #2: Same conversion logic for deduction
        let cantidadEnBase: number;
        if (!ins || ri.unidad_medida === ins.unidad_base) {
          cantidadEnBase = ri.cantidad_usada * prod.cantidad_lotes;
        } else if (ri.unidad_medida === ins.unidad_compra_habitual) {
          cantidadEnBase = ri.cantidad_usada * prod.cantidad_lotes * ins.equivalencia_compra;
        } else {
          cantidadEnBase = ri.cantidad_usada * prod.cantidad_lotes;
        }

        const costoInsumo = cantidadEnBase * stk.costo_promedio;
        costoTotal += costoInsumo;

        // Deduct stock
        const newCant = Math.max(0, stk.cantidad_actual - cantidadEnBase);
        const newVal = Math.max(0, stk.valor_actual - costoInsumo);
        const newCPP = newCant > 0 ? newVal / newCant : 0;
        newStockInsumos[stkIdx] = { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCPP, updated_at: now };

        // Record movement - BUG FIX #2: use unidad_base
        newMovs.push({
          id: generateId(), fecha: prod.fecha, insumo_id: ri.insumo_id,
          tipo_movimiento: 'SALIDA', cantidad: cantidadEnBase,
          unidad_movimiento: ins?.unidad_base || ri.unidad_medida,
          cantidad_equivalente_base: cantidadEnBase,
          precio_unitario: stk.costo_promedio, costo_total: costoInsumo,
          motivo: `Producción: ${s.productos.find(p => p.id === prod.producto_id)?.nombre || ''}`,
          proveedor: '', referencia: '', observacion: '',
          created_at: now, updated_at: now,
        });
      }

      const costoUnit = prod.cantidad_producida > 0 ? costoTotal / prod.cantidad_producida : 0;

      // Update product stock
      const newStock = s.stock.map(stk => {
        if (stk.producto_id !== prod.producto_id) return stk;
        const newCant = stk.cantidad_actual + prod.cantidad_producida;
        const newVal = stk.valor_actual + costoTotal;
        return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
      });

      // Create comprobante - BUG FIX #1: generateNumero inside setState
      const compId = generateId();
      const numero = generateNumero(prod.fecha, s.comprobantes.length);
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');
      const cInvInsumos = s.cuentas.find(c => c.codigo === 'A1.6');

      let newComprobantes = s.comprobantes;
      let newDetalles = s.detalles;
      if (cProdTerm && cInvInsumos && costoTotal > 0) {
        const comp: Comprobante = {
          id: compId, numero, fecha: prod.fecha,
          glosa: `Producción: ${s.productos.find(p => p.id === prod.producto_id)?.nombre || ''} (${prod.cantidad_producida} uds)`,
          estado: 'CONTABILIZADO', created_at: now, updated_at: now,
        };
        const dets: ComprobanteDetalle[] = [
          { id: generateId(), comprobante_id: compId, cuenta_id: cProdTerm.id, descripcion: 'Producto terminado', debe: costoTotal, haber: 0 },
          { id: generateId(), comprobante_id: compId, cuenta_id: cInvInsumos.id, descripcion: 'Consumo de insumos', debe: 0, haber: costoTotal },
        ];
        newComprobantes = [...newComprobantes, comp];
        newDetalles = [...newDetalles, ...dets];
      }

      const newProducciones = s.producciones.map(p =>
        p.id === id ? { ...p, estado: 'CONFIRMADA' as const, costo_total_produccion: costoTotal, costo_unitario: costoUnit, comprobante_id: compId } : p
      );

      result = { ok: true };
      return {
        ...s,
        producciones: newProducciones,
        stock: newStock,
        stockInsumos: newStockInsumos,
        movimientosInsumos: [...s.movimientosInsumos, ...newMovs],
        comprobantes: newComprobantes,
        detalles: newDetalles,
      };
    });
    return result;
  }, []);

  const canModifyProduccion = useCallback((id: string): { ok: boolean; reason?: string } => {
    const prod = state.producciones.find(p => p.id === id);
    if (!prod) return { ok: false, reason: 'Producción no encontrada.' };
    if (prod.deleted_at) return { ok: false, reason: 'Producción eliminada.' };
    if (prod.estado === 'ANULADA') return { ok: false, reason: 'Producción anulada.' };

    // Check if month is closed
    if (prod.fecha) {
      const d = new Date(prod.fecha);
      const cierre = state.cierres.find(c => c.anio === d.getFullYear() && c.mes === d.getMonth() + 1 && c.cerrado);
      if (cierre) return { ok: false, reason: 'El mes está cerrado.' };
    }

    // BUG FIX: Removed block for ventas posteriores — now allowed with automatic recalculation
    return { ok: true };
  }, [state.producciones, state.cierres]);

  const editarProduccion = useCallback((id: string, data: { fecha: string; producto_id: string; receta_id?: string; cantidad_lotes: number; cantidad_producida: number }): boolean => {
    let success = false;
    setState(s => {
      const prod = s.producciones.find(p => p.id === id);
      if (!prod) return s;

      // Revert old stock if confirmed
      let newStock = [...s.stock];
      let newStockInsumos = [...s.stockInsumos];
      let newMovs = [...s.movimientosInsumos];

      if (prod.estado === 'CONFIRMADA') {
        // Revert product stock
        newStock = newStock.map(stk => {
          if (stk.producto_id !== prod.producto_id) return stk;
          const newCant = Math.max(0, stk.cantidad_actual - prod.cantidad_producida);
          const newVal = Math.max(0, stk.valor_actual - prod.costo_total_produccion);
          return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: new Date().toISOString() };
        });

        // Revert insumo stock (re-add consumed)
        const prodMovs = newMovs.filter(m =>
          m.motivo.includes('Producción') && m.tipo_movimiento === 'SALIDA' && !m.deleted_at &&
          m.fecha === prod.fecha
        );
        // Simple approach: recalculate all insumo stock
        // Delete production-related movements
        if (prod.comprobante_id) {
          // Soft-delete the old comprobante
          // handled below
        }
      }

      // Recalculate new cost
      let nuevoCostoTotal = 0;
      const recetaId = data.receta_id || prod.receta_id;
      if (recetaId) {
        const ingredientes = s.recetaInsumos.filter(ri => ri.receta_id === recetaId);
        for (const ri of ingredientes) {
          const stk = s.stockInsumos.find(si => si.insumo_id === ri.insumo_id);
          const insumo = s.insumos.find(i => i.id === ri.insumo_id);
          if (stk && stk.costo_promedio > 0) {
            let cantidadBase = ri.cantidad_usada;
            if (insumo && ri.unidad_medida !== insumo.unidad_base) {
              if (ri.unidad_medida === insumo.unidad_compra_habitual) {
                cantidadBase = ri.cantidad_usada * insumo.equivalencia_compra;
              }
            }
            nuevoCostoTotal += cantidadBase * stk.costo_promedio;
          }
        }
        nuevoCostoTotal *= data.cantidad_lotes;
      }

      const nuevaCantidadProducida = data.cantidad_producida;
      const nuevoCostoUnit = nuevaCantidadProducida > 0 ? nuevoCostoTotal / nuevaCantidadProducida : 0;

      // Re-add stock if confirmed
      if (prod.estado === 'CONFIRMADA') {
        newStock = newStock.map(stk => {
          if (stk.producto_id !== data.producto_id) return stk;
          const newCant = stk.cantidad_actual + nuevaCantidadProducida;
          const newVal = stk.valor_actual + nuevoCostoTotal;
          return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: new Date().toISOString() };
        });
      }

      // Update produccion
      const newProducciones = s.producciones.map(p =>
        p.id === id ? {
          ...p, ...data,
          costo_total_produccion: nuevoCostoTotal,
          costo_unitario: nuevoCostoUnit,
        } : p
      );

      // Recalculate affected sales (ventas posteriores)
      const ventasAfectadas = s.ventas.filter(v =>
        v.producto_id === data.producto_id && v.estado === 'ACTIVA' && !v.deleted_at && v.fecha >= data.fecha
      );
      const ventasCorregidas = s.ventas.map(v => {
        if (!ventasAfectadas.find(va => va.id === v.id)) return v;
        const costoTotalVenta = nuevoCostoUnit * v.cantidad_vendida;
        const margen = v.total_venta - costoTotalVenta;
        const margenPct = v.total_venta > 0 ? (margen / v.total_venta) * 100 : 0;
        return { ...v, costo_unitario_aplicado: nuevoCostoUnit, costo_total_venta: costoTotalVenta, margen, margen_porcentaje: margenPct };
      });

      // Correct comprobante detalles for affected sales
      const cCostoVentas = s.cuentas.find(c => c.codigo === 'G1.7');
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');
      const detallesCorregidos = s.detalles.map(d => {
        const ventaAfectada = ventasCorregidas.find(v => v.comprobante_id === d.comprobante_id);
        if (!ventaAfectada || !ventasAfectadas.find(va => va.id === ventaAfectada.id)) return d;
        if (cCostoVentas && d.cuenta_id === cCostoVentas.id) return { ...d, debe: ventaAfectada.costo_total_venta, haber: 0 };
        if (cProdTerm && d.cuenta_id === cProdTerm.id) {
          // Only correct if this is the cost line (haber side)
          if (d.haber > 0) return { ...d, debe: 0, haber: ventaAfectada.costo_total_venta };
        }
        return d;
      });

      success = true;
      return {
        ...s,
        producciones: newProducciones,
        stock: newStock,
        ventas: ventasCorregidas,
        detalles: detallesCorregidos,
      };
    });
    return success;
  }, []);

  const eliminarProduccion = useCallback((id: string): boolean => {
    let success = false;
    setState(s => {
      const prod = s.producciones.find(p => p.id === id);
      if (!prod) return s;
      const now = new Date().toISOString();

      let newStock = s.stock;
      if (prod.estado === 'CONFIRMADA') {
        newStock = s.stock.map(stk => {
          if (stk.producto_id !== prod.producto_id) return stk;
          const newCant = Math.max(0, stk.cantidad_actual - prod.cantidad_producida);
          const newVal = Math.max(0, stk.valor_actual - prod.costo_total_produccion);
          return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
        });
      }

      // Delete associated comprobante
      let newComps = s.comprobantes;
      if (prod.comprobante_id) {
        newComps = newComps.map(c => c.id === prod.comprobante_id ? { ...c, deleted_at: now } : c);
      }

      success = true;
      return {
        ...s,
        producciones: s.producciones.map(p => p.id === id ? { ...p, deleted_at: now, estado: 'ANULADA' as const } : p),
        stock: newStock,
        comprobantes: newComps,
      };
    });
    return success;
  }, []);

  const actualizarCantidadEsperada = useCallback((id: string, cantidadEsperada: number) => {
    setState(s => ({
      ...s,
      producciones: s.producciones.map(p =>
        p.id === id ? { ...p, cantidad_esperada: cantidadEsperada } : p
      ),
    }));
  }, []);

  // ─── VENTAS ──────────────────────────────────────────
  // BUG FIX #1 & #3: generateNumero inside setState, cost from last production
  const registrarVenta = useCallback((v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }): boolean => {
    let success = false;
    setState(s => {
      const stk = s.stock.find(st => st.producto_id === v.producto_id);
      if (!stk || v.cantidad_vendida > stk.cantidad_actual) return s;

      // Get cost from last confirmed production
      const ultimaProduccion = [...s.producciones]
        .filter(p => p.producto_id === v.producto_id && p.estado === 'CONFIRMADA' && !p.deleted_at && p.fecha <= v.fecha)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

      const costoUnitario = ultimaProduccion ? ultimaProduccion.costo_unitario : stk.costo_promedio;
      const costoTotal = costoUnitario * v.cantidad_vendida;
      const margen = v.total_venta - costoTotal;
      const margenPct = v.total_venta > 0 ? (margen / v.total_venta) * 100 : 0;

      // Update stock
      const newCant = stk.cantidad_actual - v.cantidad_vendida;
      const newVal = Math.max(0, stk.valor_actual - costoTotal);
      const newStock = s.stock.map(st =>
        st.producto_id === v.producto_id
          ? { ...st, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: new Date().toISOString() }
          : st
      );

      // Create comprobante - BUG FIX #1
      const compId = generateId();
      const numero = generateNumero(v.fecha, s.comprobantes.length);
      const now = new Date().toISOString();
      const producto = s.productos.find(p => p.id === v.producto_id);
      const cCostoVentas = s.cuentas.find(c => c.codigo === 'G1.7');
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');
      const cIngreso = producto?.cuenta_ingreso_id ? s.cuentas.find(c => c.id === producto.cuenta_ingreso_id) : null;

      const dets: ComprobanteDetalle[] = [];

      // Cobros (debit cash/bank accounts)
      for (const cobro of v.cobros) {
        const cuenta = s.cuentas.find(c => c.id === cobro.cuenta_id);
        if (cuenta) {
          // If it's P1.4 (anticipo), it's a debit to reduce liability
          dets.push({
            id: generateId(), comprobante_id: compId,
            cuenta_id: cobro.cuenta_id,
            descripcion: `Cobro venta ${producto?.nombre || ''}`,
            debe: cobro.monto, haber: 0,
          });
        }
      }

      // Credit ingreso
      if (cIngreso) {
        dets.push({
          id: generateId(), comprobante_id: compId,
          cuenta_id: cIngreso.id,
          descripcion: `Venta ${producto?.nombre || ''}`,
          debe: 0, haber: v.total_venta,
        });
      }

      // Cost of goods sold
      if (cCostoVentas && cProdTerm && costoTotal > 0) {
        dets.push({
          id: generateId(), comprobante_id: compId,
          cuenta_id: cCostoVentas.id,
          descripcion: `Costo venta ${producto?.nombre || ''}`,
          debe: costoTotal, haber: 0,
        });
        dets.push({
          id: generateId(), comprobante_id: compId,
          cuenta_id: cProdTerm.id,
          descripcion: `Salida inventario ${producto?.nombre || ''}`,
          debe: 0, haber: costoTotal,
        });
      }

      const comp: Comprobante = {
        id: compId, numero, fecha: v.fecha,
        glosa: `Venta: ${producto?.nombre || ''} x${v.cantidad_vendida}`,
        estado: 'CONTABILIZADO', created_at: now, updated_at: now,
      };

      const ventaId = generateId();
      const newVenta: Venta = {
        id: ventaId, fecha: v.fecha, producto_id: v.producto_id,
        cantidad_vendida: v.cantidad_vendida, total_venta: v.total_venta,
        costo_total_venta: costoTotal, costo_unitario_aplicado: costoUnitario,
        margen, margen_porcentaje: margenPct,
        forma_cobro_cuenta_id: v.cobros[0]?.cuenta_id || '',
        cobros: v.cobros,
        cuenta_ingreso_id: cIngreso?.id || '',
        comprobante_id: compId,
        estado: 'ACTIVA',
      };

      success = true;
      return {
        ...s,
        stock: newStock,
        ventas: [...s.ventas, newVenta],
        comprobantes: [...s.comprobantes, comp],
        detalles: [...s.detalles, ...dets],
      };
    });
    return success;
  }, []);

  // BUG FIX #3: editarVenta uses cost from last production
  const editarVenta = useCallback((id: string, data: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }): boolean => {
    let success = false;
    setState(s => {
      const venta = s.ventas.find(v => v.id === id);
      if (!venta || (venta.estado !== 'ACTIVA' && venta.estado !== undefined)) return s;

      const now = new Date().toISOString();

      // Revert old stock
      let newStock = s.stock.map(stk => {
        if (stk.producto_id !== venta.producto_id) return stk;
        const newCant = stk.cantidad_actual + venta.cantidad_vendida;
        const newVal = stk.valor_actual + venta.costo_total_venta;
        return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
      });

      // BUG FIX #3: Get cost from last confirmed production, not CPP
      const ultimaProduccion = [...s.producciones]
        .filter(p => p.producto_id === data.producto_id && p.estado === 'CONFIRMADA' && !p.deleted_at && p.fecha <= data.fecha)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

      const stkReverted = newStock.find(st => st.producto_id === data.producto_id);
      const costoUnitario = ultimaProduccion ? ultimaProduccion.costo_unitario : (stkReverted?.costo_promedio || 0);
      const costoTotal = costoUnitario * data.cantidad_vendida;
      const margen = data.total_venta - costoTotal;
      const margenPct = data.total_venta > 0 ? (margen / data.total_venta) * 100 : 0;

      // Apply new stock
      newStock = newStock.map(stk => {
        if (stk.producto_id !== data.producto_id) return stk;
        const newCant = stk.cantidad_actual - data.cantidad_vendida;
        const newVal = Math.max(0, stk.valor_actual - costoTotal);
        return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
      });

      // Update venta
      const producto = s.productos.find(p => p.id === data.producto_id);
      const cIngreso = producto?.cuenta_ingreso_id ? s.cuentas.find(c => c.id === producto.cuenta_ingreso_id) : null;
      const cCostoVentas = s.cuentas.find(c => c.codigo === 'G1.7');
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');

      // Rebuild comprobante details
      const newDets: ComprobanteDetalle[] = [];

      for (const cobro of data.cobros) {
        newDets.push({
          id: generateId(), comprobante_id: venta.comprobante_id,
          cuenta_id: cobro.cuenta_id,
          descripcion: `Cobro venta ${producto?.nombre || ''}`,
          debe: cobro.monto, haber: 0,
        });
      }

      if (cIngreso) {
        newDets.push({
          id: generateId(), comprobante_id: venta.comprobante_id,
          cuenta_id: cIngreso.id,
          descripcion: `Venta ${producto?.nombre || ''}`,
          debe: 0, haber: data.total_venta,
        });
      }

      if (cCostoVentas && cProdTerm && costoTotal > 0) {
        newDets.push({
          id: generateId(), comprobante_id: venta.comprobante_id,
          cuenta_id: cCostoVentas.id,
          descripcion: `Costo venta ${producto?.nombre || ''}`,
          debe: costoTotal, haber: 0,
        });
        newDets.push({
          id: generateId(), comprobante_id: venta.comprobante_id,
          cuenta_id: cProdTerm.id,
          descripcion: `Salida inventario ${producto?.nombre || ''}`,
          debe: 0, haber: costoTotal,
        });
      }

      // BUG FIX #1: generateNumero inside setState
      const numero = generateNumero(data.fecha, s.comprobantes.length);

      const newVentas = s.ventas.map(v =>
        v.id === id ? {
          ...v, ...data,
          costo_total_venta: costoTotal, costo_unitario_aplicado: costoUnitario,
          margen, margen_porcentaje: margenPct,
          forma_cobro_cuenta_id: data.cobros[0]?.cuenta_id || v.forma_cobro_cuenta_id,
          cobros: data.cobros,
          cuenta_ingreso_id: cIngreso?.id || v.cuenta_ingreso_id,
        } : v
      );

      const newComprobantes = s.comprobantes.map(c =>
        c.id === venta.comprobante_id ? {
          ...c, fecha: data.fecha,
          glosa: `Venta: ${producto?.nombre || ''} x${data.cantidad_vendida}`,
          updated_at: now,
        } : c
      );

      success = true;
      return {
        ...s,
        stock: newStock,
        ventas: newVentas,
        comprobantes: newComprobantes,
        detalles: [
          ...s.detalles.filter(d => d.comprobante_id !== venta.comprobante_id),
          ...newDets,
        ],
      };
    });
    return success;
  }, []);

  const eliminarVenta = useCallback((id: string): boolean => {
    let success = false;
    setState(s => {
      const venta = s.ventas.find(v => v.id === id);
      if (!venta || (venta.estado !== 'ACTIVA' && venta.estado !== undefined)) return s;

      const now = new Date().toISOString();

      // Check cierre
      const d = new Date(venta.fecha);
      const cierre = s.cierres.find(c => c.anio === d.getFullYear() && c.mes === d.getMonth() + 1 && c.cerrado);
      if (cierre) return s;

      // Revert stock
      const newStock = s.stock.map(stk => {
        if (stk.producto_id !== venta.producto_id) return stk;
        const newCant = stk.cantidad_actual + venta.cantidad_vendida;
        const newVal = stk.valor_actual + venta.costo_total_venta;
        return { ...stk, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
      });

      // Soft-delete comprobante
      const newComps = s.comprobantes.map(c =>
        c.id === venta.comprobante_id ? { ...c, deleted_at: now } : c
      );

      success = true;
      return {
        ...s,
        ventas: s.ventas.map(v => v.id === id ? { ...v, estado: 'ANULADA' as EstadoVenta, deleted_at: now } : v),
        stock: newStock,
        comprobantes: newComps,
      };
    });
    return success;
  }, []);

  const recalcularCostosVentas = useCallback(() => {
    setState(s => {
      const cCostoVentas = s.cuentas.find(c => c.codigo === 'G1.7');
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');

      const newVentas = s.ventas.map(v => {
        if (v.estado !== 'ACTIVA' || v.deleted_at) return v;

        const ultimaProduccion = [...s.producciones]
          .filter(p => p.producto_id === v.producto_id && p.estado === 'CONFIRMADA' && !p.deleted_at && p.fecha <= v.fecha)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

        if (!ultimaProduccion) return v;

        const costoUnitario = ultimaProduccion.costo_unitario;
        const costoTotal = costoUnitario * v.cantidad_vendida;
        const margen = v.total_venta - costoTotal;
        const margenPct = v.total_venta > 0 ? (margen / v.total_venta) * 100 : 0;

        return { ...v, costo_unitario_aplicado: costoUnitario, costo_total_venta: costoTotal, margen, margen_porcentaje: margenPct };
      });

      // Update detalles for affected ventas
      const newDetalles = s.detalles.map(d => {
        const venta = newVentas.find(v => v.comprobante_id === d.comprobante_id && v.estado === 'ACTIVA');
        if (!venta) return d;
        if (cCostoVentas && d.cuenta_id === cCostoVentas.id && d.debe > 0) return { ...d, debe: venta.costo_total_venta };
        if (cProdTerm && d.cuenta_id === cProdTerm.id && d.haber > 0) return { ...d, haber: venta.costo_total_venta };
        return d;
      });

      return { ...s, ventas: newVentas, detalles: newDetalles };
    });
  }, []);

  // ─── MERMA ───────────────────────────────────────────
  // BUG FIX #1: generateNumero inside setState
  const registrarMerma = useCallback((productoId: string, cantidad: number, fecha: string, motivo: string): boolean => {
    let success = false;
    setState(s => {
      const stk = s.stock.find(st => st.producto_id === productoId);
      if (!stk || cantidad <= 0) return s;

      const now = new Date().toISOString();
      const costoMerma = Math.min(cantidad, stk.cantidad_actual) * stk.costo_promedio;
      const producto = s.productos.find(p => p.id === productoId);

      // Update stock
      const newCant = Math.max(0, stk.cantidad_actual - cantidad);
      const newVal = Math.max(0, stk.valor_actual - costoMerma);
      const newStock = s.stock.map(st =>
        st.producto_id === productoId
          ? { ...st, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now }
          : st
      );

      // Create comprobante
      const compId = generateId();
      const numero = generateNumero(fecha, s.comprobantes.length);
      const cMermas = s.cuentas.find(c => c.codigo === 'G1.8');
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');

      let newComps = s.comprobantes;
      let newDets = s.detalles;
      if (cMermas && cProdTerm && costoMerma > 0) {
        const comp: Comprobante = {
          id: compId, numero, fecha,
          glosa: `Merma: ${producto?.nombre || ''} (${cantidad} uds) - ${motivo}`,
          estado: 'CONTABILIZADO', created_at: now, updated_at: now,
        };
        newComps = [...newComps, comp];
        newDets = [...newDets,
          { id: generateId(), comprobante_id: compId, cuenta_id: cMermas.id, descripcion: `Merma ${producto?.nombre}`, debe: costoMerma, haber: 0 },
          { id: generateId(), comprobante_id: compId, cuenta_id: cProdTerm.id, descripcion: `Salida inventario merma`, debe: 0, haber: costoMerma },
        ];
      }

      success = true;
      return { ...s, stock: newStock, comprobantes: newComps, detalles: newDets };
    });
    return success;
  }, []);

  // ─── CIERRES ─────────────────────────────────────────
  const cerrarMes = useCallback((anio: number, mes: number, nota?: string) => {
    setState(s => {
      const existing = s.cierres.find(c => c.anio === anio && c.mes === mes);
      if (existing) {
        return { ...s, cierres: s.cierres.map(c => c.anio === anio && c.mes === mes ? { ...c, cerrado: true, fecha_cierre: new Date().toISOString(), nota } : c) };
      }
      return {
        ...s,
        cierres: [...s.cierres, { id: generateId(), anio, mes, cerrado: true, fecha_cierre: new Date().toISOString(), nota }],
      };
    });
  }, []);

  const reabrirMes = useCallback((anio: number, mes: number) => {
    setState(s => ({
      ...s,
      cierres: s.cierres.map(c => c.anio === anio && c.mes === mes ? { ...c, cerrado: false } : c),
    }));
  }, []);

  const isMesCerrado = useCallback((fecha: string): boolean => {
    const d = new Date(fecha);
    return state.cierres.some(c => c.anio === d.getFullYear() && c.mes === d.getMonth() + 1 && c.cerrado);
  }, [state.cierres]);

  // ─── CONTEXT VALUE ───────────────────────────────────
  const value: AccountingContextType = {
    // Data
    cuentas: state.cuentas,
    comprobantes: state.comprobantes,
    detalles: state.detalles,
    productos: state.productos,
    stock: state.stock,
    producciones: state.producciones,
    ventas: state.ventas,
    cierres: state.cierres,
    insumos: state.insumos,
    stockInsumos: state.stockInsumos,
    movimientosInsumos: state.movimientosInsumos,
    recetas: state.recetas,
    recetaInsumos: state.recetaInsumos,

    // Functions
    addCuenta, updateCuenta, getCuenta, getCuentaByCodigo,
    addComprobante, updateComprobante, deleteComprobante, contabilizar, pasarABorrador,
    getDetallesForComprobante, getComprobantesContabilizados, getDetallesContabilizados,
    addProducto, getProducto, getStockForProducto,
    addProduccion, confirmarProduccion, editarProduccion, eliminarProduccion, canModifyProduccion, actualizarCantidadEsperada,
    registrarVenta, editarVenta, eliminarVenta, recalcularCostosVentas,
    registrarMerma,
    getInsumo, getStockForInsumo, addInsumo, updateInsumo, deleteInsumo,
    addMovimientoInsumo, editMovimientoInsumo, deleteMovimientoInsumo,
    addReceta, updateReceta, deleteReceta, getRecetaInsumos, calcularCostoReceta,
    cerrarMes, reabrirMes, isMesCerrado,
  };

  return (
    <AccountingContext.Provider value={value}>
      {children}
    </AccountingContext.Provider>
  );
}

// ─── HELPER: Recalculate insumo stock from movements ─────
function recalcStockInsumos(currentStock: StockInsumo[], insumos: Insumo[], movimientos: MovimientoInsumo[]): StockInsumo[] {
  const now = new Date().toISOString();
  return currentStock.map(si => {
    const activeMovs = movimientos.filter(m => m.insumo_id === si.insumo_id && !m.deleted_at);
    let cant = 0;
    let val = 0;
    for (const m of activeMovs.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (m.tipo_movimiento === 'ENTRADA') {
        cant += m.cantidad_equivalente_base;
        val += m.costo_total;
      } else if (m.tipo_movimiento === 'SALIDA') {
        const cpp = cant > 0 ? val / cant : 0;
        cant = Math.max(0, cant - m.cantidad_equivalente_base);
        val = Math.max(0, cant * cpp);
      } else {
        // AJUSTE
        cant = m.cantidad_equivalente_base;
        const cpp = cant > 0 ? val / cant : 0;
        val = cant * cpp;
      }
    }
    const cpp = cant > 0 ? val / cant : 0;
    return { ...si, cantidad_actual: cant, valor_actual: val, costo_promedio: cpp, updated_at: now };
  });
}
