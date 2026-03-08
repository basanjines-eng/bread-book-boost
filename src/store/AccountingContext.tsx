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
  getInitialRecetas, getNextIngresoCodigo,
} from '@/lib/accounting';

interface AccountingState {
  cuentas: Cuenta[];
  comprobantes: Comprobante[];
  detalles: ComprobanteDetalle[];
  productos: Producto[];
  producciones: Produccion[];
  stock: StockProducto[];
  ventas: Venta[];
  cierres: CierreMensual[];
  insumos: Insumo[];
  stockInsumos: StockInsumo[];
  movimientosInsumos: MovimientoInsumo[];
  recetas: Receta[];
  recetaInsumos: RecetaInsumo[];
}

interface AccountingContextType extends AccountingState {
  // Cuentas
  addCuenta: (c: Omit<Cuenta, 'id'>) => void;
  updateCuenta: (c: Cuenta) => void;
  // Productos
  addProducto: (nombre: string) => void;
  // Comprobantes
  addComprobante: (comp: Omit<Comprobante, 'id' | 'numero' | 'created_at' | 'updated_at'>, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => string;
  updateComprobante: (comp: Comprobante, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => void;
  deleteComprobante: (id: string) => void;
  contabilizar: (id: string) => boolean;
  pasarABorrador: (id: string) => void;
  // Insumos
  addInsumo: (i: Omit<Insumo, 'id' | 'created_at' | 'updated_at'>) => void;
  updateInsumo: (i: Insumo) => void;
  deleteInsumo: (id: string) => void;
  // Movimientos Insumos
  addMovimientoInsumo: (m: Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>, cuenta_pago_id?: string) => void;
  editMovimientoInsumo: (id: string, m: Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>) => boolean;
  deleteMovimientoInsumo: (id: string) => boolean;
  // Recetas
  addReceta: (r: Omit<Receta, 'id' | 'created_at' | 'updated_at'>, ingredientes: Omit<RecetaInsumo, 'id' | 'receta_id' | 'created_at' | 'updated_at'>[]) => string;
  updateReceta: (id: string, r: Partial<Omit<Receta, 'id'>>, ingredientes: Omit<RecetaInsumo, 'id' | 'receta_id' | 'created_at' | 'updated_at'>[]) => void;
  deleteReceta: (id: string) => void;
  getRecetaInsumos: (recetaId: string) => RecetaInsumo[];
  calcularCostoReceta: (recetaId: string) => number;
  // Produccion
  addProduccion: (p: Omit<Produccion, 'id' | 'costo_unitario' | 'costo_total_produccion'>) => void;
  confirmarProduccion: (id: string) => { ok: boolean; faltante?: string };
  eliminarProduccion: (id: string) => boolean;
  editarProduccion: (id: string, data: { fecha: string; producto_id: string; receta_id?: string; cantidad_lotes: number; cantidad_producida: number }) => boolean;
  canModifyProduccion: (id: string) => { ok: boolean; reason?: string };
  // Ventas
  registrarVenta: (v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }) => string | null;
  eliminarVenta: (id: string) => boolean;
  editarVenta: (id: string, v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }) => boolean;
  recalcularCostosVentas: () => void;
  // Stock
  updateStockMinimo: (producto_id: string, minimo: number) => void;
  // Cierres
  cerrarMes: (anio: number, mes: number, nota?: string) => void;
  reabrirMes: (anio: number, mes: number) => void;
  isMesCerrado: (fecha: string) => boolean;
  // Helpers
  getCuenta: (id: string) => Cuenta | undefined;
  getCuentaByCodigo: (codigo: string) => Cuenta | undefined;
  getProducto: (id: string) => Producto | undefined;
  getInsumo: (id: string) => Insumo | undefined;
  getStockForProducto: (producto_id: string) => StockProducto | undefined;
  getStockForInsumo: (insumo_id: string) => StockInsumo | undefined;
  getDetallesForComprobante: (comprobante_id: string) => ComprobanteDetalle[];
  getComprobantesContabilizados: () => Comprobante[];
  getDetallesContabilizados: () => ComprobanteDetalle[];
}

const AccountingContext = createContext<AccountingContextType | null>(null);

const STORAGE_KEY = 'panconta_data';

function loadState(): AccountingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(state: AccountingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function migrateVentasCobros(state: AccountingState): AccountingState {
  let changed = false;
  const ventas = state.ventas.map(v => {
    if (!v.cobros || v.cobros.length === 0) {
      changed = true;
      return { ...v, cobros: [{ cuenta_id: v.forma_cobro_cuenta_id, monto: v.total_venta }] };
    }
    return v;
  });
  if (changed) return { ...state, ventas };
  return state;
}

function migrateInsumos(state: AccountingState): AccountingState {
  if (state.insumos && state.insumos.length > 0) return state;
  const insumos = getInitialInsumos();
  const stockInsumos = getInitialStockInsumos(insumos);
  return {
    ...state,
    insumos,
    stockInsumos,
    movimientosInsumos: state.movimientosInsumos || [],
    recetas: state.recetas || [],
    recetaInsumos: state.recetaInsumos || [],
  };
}

function initState(): AccountingState {
  const saved = loadState();
  if (saved && saved.cuentas?.length > 0) {
    let s = migrateVentasCobros(saved);
    s = migrateInsumos(s);
    // Ensure arrays exist
    if (!s.recetas) s.recetas = [];
    if (!s.recetaInsumos) s.recetaInsumos = [];
    if (!s.movimientosInsumos) s.movimientosInsumos = [];
    return s;
  }
  const cuentas = getInitialCuentas();
  const productos = getInitialProductos(cuentas);
  const stock = getInitialStock(productos);
  const insumos = getInitialInsumos();
  const stockInsumos = getInitialStockInsumos(insumos);
  const { recetas, recetaInsumos } = getInitialRecetas(productos, insumos);
  return {
    cuentas, comprobantes: [], detalles: [], productos, producciones: [], stock, ventas: [], cierres: [],
    insumos, stockInsumos, movimientosInsumos: [], recetas, recetaInsumos,
  };
}

export function AccountingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountingState>(initState);

  useEffect(() => { saveState(state); }, [state]);

  const getCuenta = useCallback((id: string) => state.cuentas.find(c => c.id === id), [state.cuentas]);
  const getCuentaByCodigo = useCallback((codigo: string) => state.cuentas.find(c => c.codigo === codigo), [state.cuentas]);
  const getProducto = useCallback((id: string) => state.productos.find(p => p.id === id), [state.productos]);
  const getInsumo = useCallback((id: string) => state.insumos.find(i => i.id === id && !i.deleted_at), [state.insumos]);
  const getStockForProducto = useCallback((pid: string) => state.stock.find(s => s.producto_id === pid), [state.stock]);
  const getStockForInsumo = useCallback((iid: string) => state.stockInsumos.find(s => s.insumo_id === iid), [state.stockInsumos]);
  const getDetallesForComprobante = useCallback((cid: string) => state.detalles.filter(d => d.comprobante_id === cid), [state.detalles]);

  const getComprobantesContabilizados = useCallback(() =>
    state.comprobantes.filter(c => c.estado === 'CONTABILIZADO' && !c.deleted_at), [state.comprobantes]);

  const getDetallesContabilizados = useCallback(() => {
    const cids = new Set(getComprobantesContabilizados().map(c => c.id));
    return state.detalles.filter(d => cids.has(d.comprobante_id));
  }, [state.detalles, getComprobantesContabilizados]);

  const isMesCerrado = useCallback((fecha: string) => {
    const d = new Date(fecha + 'T12:00:00');
    return state.cierres.some(c => c.anio === d.getFullYear() && c.mes === d.getMonth() + 1 && c.cerrado);
  }, [state.cierres]);

  // ==================== CUENTAS ====================
  const addCuenta = useCallback((c: Omit<Cuenta, 'id'>) => {
    setState(s => ({ ...s, cuentas: [...s.cuentas, { ...c, id: generateId() }] }));
  }, []);

  const updateCuenta = useCallback((c: Cuenta) => {
    setState(s => ({ ...s, cuentas: s.cuentas.map(x => x.id === c.id ? c : x) }));
  }, []);

  // ==================== COMPROBANTES ====================
  const addComprobante = useCallback((comp: Omit<Comprobante, 'id' | 'numero' | 'created_at' | 'updated_at'>, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => {
    const id = generateId();
    const now = new Date().toISOString();
    const numero = generateNumero(comp.fecha, state.comprobantes.length);
    const newComp: Comprobante = { ...comp, id, numero, created_at: now, updated_at: now };
    const newDets = dets.map(d => ({ ...d, id: generateId(), comprobante_id: id }));
    setState(s => ({ ...s, comprobantes: [...s.comprobantes, newComp], detalles: [...s.detalles, ...newDets] }));
    return id;
  }, [state.comprobantes.length]);

  const updateComprobante = useCallback((comp: Comprobante, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => {
    const updatedComp = { ...comp, updated_at: new Date().toISOString() };
    const newDets = dets.map(d => ({ ...d, id: generateId(), comprobante_id: comp.id }));
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === comp.id ? updatedComp : c),
      detalles: [...s.detalles.filter(d => d.comprobante_id !== comp.id), ...newDets],
    }));
  }, []);

  const deleteComprobante = useCallback((id: string) => {
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c),
    }));
  }, []);

  const contabilizar = useCallback((id: string): boolean => {
    const comp = state.comprobantes.find(c => c.id === id);
    if (!comp) return false;
    const dets = state.detalles.filter(d => d.comprobante_id === id);
    const totalDebe = dets.reduce((s, d) => s + d.debe, 0);
    const totalHaber = dets.reduce((s, d) => s + d.haber, 0);
    if (Math.abs(totalDebe - totalHaber) > 0.01 || dets.length === 0) return false;
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === id ? { ...c, estado: 'CONTABILIZADO', updated_at: new Date().toISOString() } : c),
    }));
    return true;
  }, [state.comprobantes, state.detalles]);

  const pasarABorrador = useCallback((id: string) => {
    setState(s => ({
      ...s,
      comprobantes: s.comprobantes.map(c => c.id === id ? { ...c, estado: 'BORRADOR', updated_at: new Date().toISOString() } : c),
    }));
  }, []);

  // ==================== INSUMOS ====================
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

  // ==================== MOVIMIENTOS INSUMOS ====================
  const applyMovimiento = (stk: StockInsumo, m: { tipo_movimiento: string; cantidad_equivalente_base: number; costo_total: number }): StockInsumo => {
    const now = new Date().toISOString();
    if (m.tipo_movimiento === 'ENTRADA') {
      const nc = stk.cantidad_actual + m.cantidad_equivalente_base;
      const nv = stk.valor_actual + m.costo_total;
      return { ...stk, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: now };
    } else if (m.tipo_movimiento === 'SALIDA') {
      const nc = stk.cantidad_actual - m.cantidad_equivalente_base;
      const nv = stk.valor_actual - (m.cantidad_equivalente_base * stk.costo_promedio);
      return { ...stk, cantidad_actual: Math.max(0, nc), valor_actual: Math.max(0, nv), costo_promedio: nc > 0 ? Math.max(0, nv) / nc : 0, updated_at: now };
    } else {
      // AJUSTE
      const nc = stk.cantidad_actual + m.cantidad_equivalente_base; // can be negative for "baja"
      const nv = nc > 0 ? nc * stk.costo_promedio : 0;
      return { ...stk, cantidad_actual: Math.max(0, nc), valor_actual: Math.max(0, nv), updated_at: now };
    }
  };

  const revertMovimiento = (stk: StockInsumo, m: { tipo_movimiento: string; cantidad_equivalente_base: number; costo_total: number }): StockInsumo => {
    const now = new Date().toISOString();
    if (m.tipo_movimiento === 'ENTRADA') {
      const nc = stk.cantidad_actual - m.cantidad_equivalente_base;
      const nv = stk.valor_actual - m.costo_total;
      return { ...stk, cantidad_actual: Math.max(0, nc), valor_actual: Math.max(0, nv), costo_promedio: nc > 0 ? Math.max(0, nv) / nc : 0, updated_at: now };
    } else if (m.tipo_movimiento === 'SALIDA') {
      const nc = stk.cantidad_actual + m.cantidad_equivalente_base;
      const nv = stk.valor_actual + (m.cantidad_equivalente_base * stk.costo_promedio);
      return { ...stk, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: now };
    } else {
      const nc = stk.cantidad_actual - m.cantidad_equivalente_base;
      const nv = nc > 0 ? nc * stk.costo_promedio : 0;
      return { ...stk, cantidad_actual: Math.max(0, nc), valor_actual: Math.max(0, nv), updated_at: now };
    }
  };

  const addMovimientoInsumo = useCallback((m: Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>, cuenta_pago_id?: string) => {
    const now = new Date().toISOString();
    const id = generateId();
    setState(s => {
      const newStockInsumos = s.stockInsumos.map(stk => {
        if (stk.insumo_id !== m.insumo_id) return stk;
        return applyMovimiento(stk, m);
      });

      let newComprobantes = s.comprobantes;
      let newDetalles = s.detalles;

      // Generate journal entry for ENTRADA with cuenta_pago_id
      if (m.tipo_movimiento === 'ENTRADA' && cuenta_pago_id && m.costo_total > 0) {
        const cInvInsumos = s.cuentas.find(c => c.codigo === 'A1.6');
        if (cInvInsumos) {
          const insumo = s.insumos.find(i => i.id === m.insumo_id);
          const compId = generateId();
          const numero = generateNumero(m.fecha, s.comprobantes.length);
          const comp: Comprobante = {
            id: compId, numero, fecha: m.fecha,
            glosa: `Compra: ${insumo?.nombre || ''} ${m.cantidad} ${m.unidad_movimiento} @ ${m.precio_unitario}`,
            estado: 'CONTABILIZADO', created_at: now, updated_at: now,
          };
          const dets: ComprobanteDetalle[] = [
            { id: generateId(), comprobante_id: compId, cuenta_id: cInvInsumos.id, descripcion: `Compra insumo ${insumo?.nombre || ''}`, debe: m.costo_total, haber: 0 },
            { id: generateId(), comprobante_id: compId, cuenta_id: cuenta_pago_id, descripcion: `Pago compra ${insumo?.nombre || ''}`, debe: 0, haber: m.costo_total },
          ];
          newComprobantes = [...newComprobantes, comp];
          newDetalles = [...newDetalles, ...dets];
        }
      }

      return {
        ...s,
        movimientosInsumos: [...s.movimientosInsumos, { ...m, id, created_at: now, updated_at: now }],
        stockInsumos: newStockInsumos,
        comprobantes: newComprobantes,
        detalles: newDetalles,
      };
    });
  }, []);

  const editMovimientoInsumo = useCallback((id: string, m: Omit<MovimientoInsumo, 'id' | 'created_at' | 'updated_at'>): boolean => {
    const orig = state.movimientosInsumos.find(x => x.id === id && !x.deleted_at);
    if (!orig) return false;
    // Check no subsequent movimientos
    const subsequent = state.movimientosInsumos.filter(x => x.insumo_id === orig.insumo_id && !x.deleted_at && x.id !== id && x.created_at > orig.created_at);
    if (subsequent.length > 0) return false;
    const now = new Date().toISOString();
    setState(s => {
      let newStockInsumos = s.stockInsumos.map(stk => {
        if (stk.insumo_id !== orig.insumo_id) return stk;
        return revertMovimiento(stk, orig);
      });
      newStockInsumos = newStockInsumos.map(stk => {
        if (stk.insumo_id !== m.insumo_id) return stk;
        return applyMovimiento(stk, m);
      });
      return {
        ...s,
        movimientosInsumos: s.movimientosInsumos.map(x => x.id === id ? { ...m, id, created_at: orig.created_at, updated_at: now } : x),
        stockInsumos: newStockInsumos,
      };
    });
    return true;
  }, [state.movimientosInsumos]);

  const deleteMovimientoInsumo = useCallback((id: string): boolean => {
    const orig = state.movimientosInsumos.find(x => x.id === id && !x.deleted_at);
    if (!orig) return false;
    const subsequent = state.movimientosInsumos.filter(x => x.insumo_id === orig.insumo_id && !x.deleted_at && x.id !== id && x.created_at > orig.created_at);
    if (subsequent.length > 0) return false;
    const now = new Date().toISOString();
    setState(s => {
      const newStockInsumos = s.stockInsumos.map(stk => {
        if (stk.insumo_id !== orig.insumo_id) return stk;
        return revertMovimiento(stk, orig);
      });
      return {
        ...s,
        movimientosInsumos: s.movimientosInsumos.map(x => x.id === id ? { ...x, deleted_at: now } : x),
        stockInsumos: newStockInsumos,
      };
    });
    return true;
  }, [state.movimientosInsumos]);

  // ==================== RECETAS ====================
  const getRecetaInsumos = useCallback((recetaId: string) =>
    state.recetaInsumos.filter(ri => ri.receta_id === recetaId), [state.recetaInsumos]);

  const calcularCostoReceta = useCallback((recetaId: string): number => {
    const ingredientes = state.recetaInsumos.filter(ri => ri.receta_id === recetaId);
    return ingredientes.reduce((total, ri) => {
      const stk = state.stockInsumos.find(s => s.insumo_id === ri.insumo_id);
      return total + (ri.cantidad_usada * (stk?.costo_promedio || 0));
    }, 0);
  }, [state.recetaInsumos, state.stockInsumos]);

  const addReceta = useCallback((r: Omit<Receta, 'id' | 'created_at' | 'updated_at'>, ingredientes: Omit<RecetaInsumo, 'id' | 'receta_id' | 'created_at' | 'updated_at'>[]): string => {
    const now = new Date().toISOString();
    const id = generateId();
    const newIngredientes = ingredientes.map(i => ({ ...i, id: generateId(), receta_id: id, created_at: now, updated_at: now }));
    setState(s => ({
      ...s,
      recetas: [...s.recetas, { ...r, id, created_at: now, updated_at: now }],
      recetaInsumos: [...s.recetaInsumos, ...newIngredientes],
    }));
    return id;
  }, []);

  const updateReceta = useCallback((id: string, r: Partial<Omit<Receta, 'id'>>, ingredientes: Omit<RecetaInsumo, 'id' | 'receta_id' | 'created_at' | 'updated_at'>[]) => {
    const now = new Date().toISOString();
    const newIngredientes = ingredientes.map(i => ({ ...i, id: generateId(), receta_id: id, created_at: now, updated_at: now }));
    setState(s => ({
      ...s,
      recetas: s.recetas.map(x => x.id === id ? { ...x, ...r, updated_at: now } : x),
      recetaInsumos: [...s.recetaInsumos.filter(ri => ri.receta_id !== id), ...newIngredientes],
    }));
  }, []);

  const deleteReceta = useCallback((id: string) => {
    setState(s => ({
      ...s,
      recetas: s.recetas.map(r => r.id === id ? { ...r, deleted_at: new Date().toISOString(), activo: false } : r),
    }));
  }, []);

  // ==================== PRODUCCION ====================
  const addProduccion = useCallback((p: Omit<Produccion, 'id' | 'costo_unitario' | 'costo_total_produccion'>) => {
    // Calculate cost from recipe
    let costoTotal = 0;
    if (p.receta_id) {
      const costoReceta = calcularCostoReceta(p.receta_id);
      costoTotal = costoReceta * p.cantidad_lotes;
    }
    const costo_unitario = p.cantidad_producida > 0 ? costoTotal / p.cantidad_producida : 0;
    setState(s => ({ ...s, producciones: [...s.producciones, { ...p, id: generateId(), costo_total_produccion: costoTotal, costo_unitario }] }));
  }, [calcularCostoReceta]);

  const confirmarProduccion = useCallback((id: string): { ok: boolean; faltante?: string } => {
    const prod = state.producciones.find(p => p.id === id);
    if (!prod || prod.estado === 'CONFIRMADA') return { ok: false };

    // Deduct insumos from stock if recipe exists
    if (prod.receta_id) {
      const ingredientes = state.recetaInsumos.filter(ri => ri.receta_id === prod.receta_id);
      // Check sufficient stock — convert to base units before comparing
      for (const ri of ingredientes) {
        const stk = state.stockInsumos.find(s => s.insumo_id === ri.insumo_id);
        const ins = state.insumos.find(i => i.id === ri.insumo_id);
        // Convert to base units if unidad_medida != unidad_base
        const equivalencia = ins?.equivalencia_compra || 1;
        const isBase = !ins || ri.unidad_medida === ins.unidad_base;
        const neededBase = isBase
          ? ri.cantidad_usada * prod.cantidad_lotes
          : ri.cantidad_usada * prod.cantidad_lotes * equivalencia;
        if (!stk || stk.cantidad_actual < neededBase) {
          const nombreInsumo = ins?.nombre || ri.insumo_id;
          const disponible = stk?.cantidad_actual ?? 0;
          const unidadBase = ins?.unidad_base || ri.unidad_medida;
          return { ok: false, faltante: `"${nombreInsumo}" (necesario: ${neededBase.toFixed(2)} ${unidadBase}, disponible: ${disponible.toFixed(2)} ${unidadBase})` };
        }
      }
    }

    // Recalculate cost at confirmation time using last ENTRADA price
    let costoConfirmado = 0;
    if (prod.receta_id) {
      costoConfirmado = calcularCostoReceta(prod.receta_id) * prod.cantidad_lotes;
    }
    const costoUnitarioConfirmado = prod.cantidad_producida > 0 ? costoConfirmado / prod.cantidad_producida : 0;

    const now = new Date().toISOString();
    setState(s => {
      let newStockInsumos = [...s.stockInsumos];
      const newMovimientos = [...s.movimientosInsumos];

      // Deduct insumos
      if (prod.receta_id) {
        const ingredientes = s.recetaInsumos.filter(ri => ri.receta_id === prod.receta_id);
        for (const ri of ingredientes) {
          const insumo = s.insumos.find(i => i.id === ri.insumo_id);
          const equivalencia = insumo?.equivalencia_compra || 1;
          const isBase = !insumo || ri.unidad_medida === insumo.unidad_base;
          const cantUsada = isBase
            ? ri.cantidad_usada * prod.cantidad_lotes
            : ri.cantidad_usada * prod.cantidad_lotes * equivalencia;
          newStockInsumos = newStockInsumos.map(stk => {
            if (stk.insumo_id !== ri.insumo_id) return stk;
            const nc = stk.cantidad_actual - cantUsada;
            const nv = stk.valor_actual - (cantUsada * stk.costo_promedio);
            return { ...stk, cantidad_actual: Math.max(0, nc), valor_actual: Math.max(0, nv), costo_promedio: nc > 0 ? Math.max(0, nv) / nc : stk.costo_promedio, updated_at: now };
          });
          // Register movement
          newMovimientos.push({
            id: generateId(), fecha: prod.fecha, insumo_id: ri.insumo_id,
            tipo_movimiento: 'SALIDA', cantidad: cantUsada, unidad_movimiento: ri.unidad_medida,
            cantidad_equivalente_base: cantUsada, precio_unitario: 0, costo_total: 0,
            motivo: `Producción: ${s.productos.find(p => p.id === prod.producto_id)?.nombre || ''}`,
            proveedor: '', referencia: `PROD-${id}`, observacion: `Lotes: ${prod.cantidad_lotes}`,
            created_at: now, updated_at: now,
          });
        }
      }

      // Update product stock
      const newStock = s.stock.map(st => {
        if (st.producto_id !== prod.producto_id) return st;
        const newCant = st.cantidad_actual + prod.cantidad_producida;
        const newVal = st.valor_actual + prod.costo_total_produccion;
        return { ...st, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
      });

      // Generate accounting entry for production
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');
      const cInvInsumos = s.cuentas.find(c => c.codigo === 'A1.6');
      let newComprobantes = s.comprobantes;
      let newDetalles = s.detalles;
      let compIdProduccion: string | undefined;

      if (cProdTerm && cInvInsumos && costoConfirmado > 0) {
        compIdProduccion = generateId();
        const productoNombre = s.productos.find(p => p.id === prod.producto_id)?.nombre || '';
        const numero = generateNumero(prod.fecha, s.comprobantes.length);
        const comp: Comprobante = {
          id: compIdProduccion, numero, fecha: prod.fecha,
          glosa: `Producción: ${productoNombre} x${prod.cantidad_producida} (${prod.cantidad_lotes} lotes)`,
          estado: 'CONTABILIZADO', created_at: now, updated_at: now,
        };
        const dets: ComprobanteDetalle[] = [
          { id: generateId(), comprobante_id: compIdProduccion, cuenta_id: cProdTerm.id, descripcion: `Producción ${productoNombre}`, debe: costoConfirmado, haber: 0 },
          { id: generateId(), comprobante_id: compIdProduccion, cuenta_id: cInvInsumos.id, descripcion: `Consumo insumos ${productoNombre}`, debe: 0, haber: costoConfirmado },
        ];
        newComprobantes = [...newComprobantes, comp];
        newDetalles = [...newDetalles, ...dets];
      }

      return {
        ...s,
        producciones: s.producciones.map(p => p.id === id ? { ...p, estado: 'CONFIRMADA' as const, costo_total_produccion: costoConfirmado, costo_unitario: costoUnitarioConfirmado, comprobante_id: compIdProduccion } : p),
        stock: newStock,
        stockInsumos: newStockInsumos,
        movimientosInsumos: newMovimientos,
        comprobantes: newComprobantes,
        detalles: newDetalles,
      };
    });
    return { ok: true };
  }, [state.producciones, state.recetaInsumos, state.stockInsumos]);

  const canModifyProduccion = useCallback((id: string): { ok: boolean; reason?: string } => {
    const prod = state.producciones.find(p => p.id === id);
    if (!prod) return { ok: false, reason: 'Producción no encontrada.' };
    if (prod.estado === 'ANULADA' || prod.deleted_at) return { ok: false, reason: 'Esta producción ya fue anulada.' };
    if (prod.estado === 'BORRADOR') return { ok: true };
    if (isMesCerrado(prod.fecha)) return { ok: false, reason: 'El mes de esta producción está cerrado.' };
    const confirmedForProduct = state.producciones
      .filter(p => p.producto_id === prod.producto_id && p.estado === 'CONFIRMADA' && !p.deleted_at)
      .sort((a, b) => a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : 0);
    const lastConfirmed = confirmedForProduct[confirmedForProduct.length - 1];
    if (lastConfirmed && lastConfirmed.id !== id) return { ok: false, reason: 'Existen producciones posteriores.' };
    const activeVentas = state.ventas.filter(v => v.producto_id === prod.producto_id && v.estado === 'ACTIVA' && !v.deleted_at && v.fecha >= prod.fecha);
    if (activeVentas.length > 0) return { ok: false, reason: 'Existen ventas posteriores.' };
    return { ok: true };
  }, [state.producciones, state.ventas, isMesCerrado]);

  const eliminarProduccion = useCallback((id: string): boolean => {
    const check = canModifyProduccion(id);
    if (!check.ok) return false;
    const prod = state.producciones.find(p => p.id === id)!;
    if (prod.estado === 'BORRADOR') {
      setState(s => ({
        ...s,
        producciones: s.producciones.map(p => p.id === id ? { ...p, estado: 'ANULADA' as const, deleted_at: new Date().toISOString() } : p),
      }));
      return true;
    }
    const stk = state.stock.find(s => s.producto_id === prod.producto_id);
    if (!stk) return false;
    const newCant = stk.cantidad_actual - prod.cantidad_producida;
    if (newCant < 0) return false;
    const now = new Date().toISOString();
    setState(s => {
      const newStock = s.stock.map(st => {
        if (st.producto_id !== prod.producto_id) return st;
        const nc = st.cantidad_actual - prod.cantidad_producida;
        const nv = st.valor_actual - prod.costo_total_produccion;
        return { ...st, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: now };
      });
      // Revert insumo movements from this production
      const prodMovimientos = s.movimientosInsumos.filter(m => m.referencia === `PROD-${id}` && !m.deleted_at);
      let newStockInsumos = [...s.stockInsumos];
      for (const mov of prodMovimientos) {
        newStockInsumos = newStockInsumos.map(stk => {
          if (stk.insumo_id !== mov.insumo_id) return stk;
          return revertMovimiento(stk, mov);
        });
      }
      // Mark production comprobante as deleted
      const prodRecord = s.producciones.find(p => p.id === id);
      const newComprobantes = prodRecord?.comprobante_id
        ? s.comprobantes.map(c => c.id === prodRecord.comprobante_id ? { ...c, deleted_at: now } : c)
        : s.comprobantes;

      return {
        ...s,
        stock: newStock,
        stockInsumos: newStockInsumos,
        movimientosInsumos: s.movimientosInsumos.map(m => m.referencia === `PROD-${id}` ? { ...m, deleted_at: now } : m),
        producciones: s.producciones.map(p => p.id === id ? { ...p, estado: 'ANULADA' as const, deleted_at: now } : p),
        comprobantes: newComprobantes,
      };
    });
    return true;
  }, [state.producciones, state.stock, canModifyProduccion]);

  const editarProduccion = useCallback((id: string, data: { fecha: string; producto_id: string; receta_id?: string; cantidad_lotes: number; cantidad_producida: number }): boolean => {
    const prod = state.producciones.find(p => p.id === id);
    if (!prod) return false;

    let costoTotal = 0;
    if (data.receta_id) {
      costoTotal = calcularCostoReceta(data.receta_id) * data.cantidad_lotes;
    }
    const costo_unitario = data.cantidad_producida > 0 ? costoTotal / data.cantidad_producida : 0;

    if (prod.estado === 'BORRADOR') {
      setState(s => ({
        ...s,
        producciones: s.producciones.map(p => p.id === id ? { ...p, ...data, costo_total_produccion: costoTotal, costo_unitario } : p),
      }));
      return true;
    }

    const check = canModifyProduccion(id);
    if (!check.ok) return false;
    if (isMesCerrado(data.fecha)) return false;

    const stk = state.stock.find(s => s.producto_id === prod.producto_id);
    if (!stk) return false;
    const revertedCant = stk.cantidad_actual - prod.cantidad_producida;
    if (revertedCant < 0) return false;
    const revertedVal = stk.valor_actual - prod.costo_total_produccion;
    const newCant = revertedCant + data.cantidad_producida;
    const newVal = revertedVal + costoTotal;
    const now = new Date().toISOString();

    setState(s => {
      const newStock = s.stock.map(st => {
        if (st.producto_id !== prod.producto_id) return st;
        return { ...st, cantidad_actual: newCant, valor_actual: newVal, costo_promedio: newCant > 0 ? newVal / newCant : 0, updated_at: now };
      });
      return {
        ...s,
        stock: newStock,
        producciones: s.producciones.map(p => p.id === id ? { ...p, ...data, costo_total_produccion: costoTotal, costo_unitario } : p),
      };
    });
    return true;
  }, [state, canModifyProduccion, isMesCerrado, calcularCostoReceta]);

  // ==================== VENTAS ====================
  const registrarVenta = useCallback((v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }): string | null => {
    const stk = state.stock.find(s => s.producto_id === v.producto_id);
    if (!stk || stk.cantidad_actual < v.cantidad_vendida) return null;
    const producto = state.productos.find(p => p.id === v.producto_id);
    if (!producto) return null;
    const totalCobros = v.cobros.reduce((s, c) => s + c.monto, 0);
    if (Math.abs(totalCobros - v.total_venta) > 0.01) return null;

    // Usar costo_unitario de la última producción confirmada del producto
    const ultimaProduccion = state.producciones
      .filter(p => p.producto_id === v.producto_id && p.estado === 'CONFIRMADA' && !p.deleted_at)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

    const costoUnitario = ultimaProduccion?.costo_unitario ?? stk.costo_promedio;
    const costoTotal = costoUnitario * v.cantidad_vendida;
    const margen = v.total_venta - costoTotal;
    const margenPct = v.total_venta > 0 ? (margen / v.total_venta) * 100 : 0;

    const cIngreso = state.cuentas.find(c => c.id === producto.cuenta_ingreso_id);
    const cCostoVentas = state.cuentas.find(c => c.codigo === 'G1.7');
    const cProdTerm = state.cuentas.find(c => c.codigo === 'A1.7');
    if (!cIngreso || !cCostoVentas || !cProdTerm) return null;

    const compId = generateId();
    const ventaId = generateId();
    const now = new Date().toISOString();
    const numero = generateNumero(v.fecha, state.comprobantes.length);

    const newComp: Comprobante = {
      id: compId, numero, fecha: v.fecha,
      glosa: `Venta: ${producto.nombre} x${v.cantidad_vendida}`,
      estado: 'CONTABILIZADO', created_at: now, updated_at: now,
    };

    const newDets: ComprobanteDetalle[] = [
      ...v.cobros.map(cobro => ({
        id: generateId(), comprobante_id: compId, cuenta_id: cobro.cuenta_id,
        descripcion: `Cobro venta ${producto.nombre}`, debe: cobro.monto, haber: 0,
      })),
      { id: generateId(), comprobante_id: compId, cuenta_id: cIngreso.id, descripcion: `Ingreso venta ${producto.nombre}`, debe: 0, haber: v.total_venta },
      { id: generateId(), comprobante_id: compId, cuenta_id: cCostoVentas.id, descripcion: `Costo de ventas ${producto.nombre}`, debe: costoTotal, haber: 0 },
      { id: generateId(), comprobante_id: compId, cuenta_id: cProdTerm.id, descripcion: `Salida inventario ${producto.nombre}`, debe: 0, haber: costoTotal },
    ];

    const newVenta: Venta = {
      id: ventaId, fecha: v.fecha, producto_id: v.producto_id,
      cantidad_vendida: v.cantidad_vendida, total_venta: v.total_venta,
      costo_total_venta: costoTotal, costo_unitario_aplicado: costoUnitario,
      margen, margen_porcentaje: margenPct,
      forma_cobro_cuenta_id: v.cobros[0]?.cuenta_id || '',
      cobros: v.cobros, cuenta_ingreso_id: cIngreso.id, comprobante_id: compId, estado: 'ACTIVA',
    };

    setState(s => {
      const newStock = s.stock.map(st => {
        if (st.producto_id !== v.producto_id) return st;
        const nc = st.cantidad_actual - v.cantidad_vendida;
        const nv = st.valor_actual - costoTotal;
        return { ...st, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: now };
      });
      return {
        ...s, stock: newStock,
        comprobantes: [...s.comprobantes, newComp],
        detalles: [...s.detalles, ...newDets],
        ventas: [...s.ventas, newVenta],
      };
    });
    return ventaId;
  }, [state]);

  const eliminarVenta = useCallback((id: string): boolean => {
    const venta = state.ventas.find(v => v.id === id && v.estado === 'ACTIVA');
    if (!venta) return false;
    if (isMesCerrado(venta.fecha)) return false;
    setState(s => {
      const newStock = s.stock.map(st => {
        if (st.producto_id !== venta.producto_id) return st;
        const nc = st.cantidad_actual + venta.cantidad_vendida;
        const nv = st.valor_actual + venta.costo_total_venta;
        return { ...st, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: new Date().toISOString() };
      });
      const now = new Date().toISOString();
      return {
        ...s, stock: newStock,
        comprobantes: s.comprobantes.map(c => c.id === venta.comprobante_id ? { ...c, deleted_at: now } : c),
        ventas: s.ventas.map(v => v.id === id ? { ...v, estado: 'ANULADA' as const, deleted_at: now } : v),
      };
    });
    return true;
  }, [state.ventas, isMesCerrado]);

  const editarVenta = useCallback((id: string, v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; cobros: VentaCobro[] }): boolean => {
    const ventaOriginal = state.ventas.find(vt => vt.id === id && (vt.estado === 'ACTIVA' || !vt.estado));
    if (!ventaOriginal) return false;
    if (isMesCerrado(ventaOriginal.fecha) || isMesCerrado(v.fecha)) return false;
    const totalCobros = v.cobros.reduce((s, c) => s + c.monto, 0);
    if (Math.abs(totalCobros - v.total_venta) > 0.01) return false;

    const stkOrig = state.stock.find(s => s.producto_id === ventaOriginal.producto_id);
    if (!stkOrig) return false;

    let revertedCant = stkOrig.cantidad_actual + ventaOriginal.cantidad_vendida;
    let revertedVal = stkOrig.valor_actual + ventaOriginal.costo_total_venta;
    let revertedCPP = revertedCant > 0 ? revertedVal / revertedCant : 0;

    if (v.producto_id !== ventaOriginal.producto_id) {
      const stkNew = state.stock.find(s => s.producto_id === v.producto_id);
      if (!stkNew || v.cantidad_vendida > stkNew.cantidad_actual) return false;
    } else {
      if (v.cantidad_vendida > revertedCant) return false;
    }

    const producto = state.productos.find(p => p.id === v.producto_id);
    if (!producto) return false;

    let newCPP = v.producto_id === ventaOriginal.producto_id ? revertedCPP : state.stock.find(s => s.producto_id === v.producto_id)!.costo_promedio;
    const costoTotal = newCPP * v.cantidad_vendida;
    const margen = v.total_venta - costoTotal;
    const margenPct = v.total_venta > 0 ? (margen / v.total_venta) * 100 : 0;

    const cIngreso = state.cuentas.find(c => c.id === producto.cuenta_ingreso_id);
    const cCostoVentas = state.cuentas.find(c => c.codigo === 'G1.7');
    const cProdTerm = state.cuentas.find(c => c.codigo === 'A1.7');
    if (!cIngreso || !cCostoVentas || !cProdTerm) return false;

    const newCompId = generateId();
    const now = new Date().toISOString();
    const numero = generateNumero(v.fecha, state.comprobantes.length);

    const newComp: Comprobante = {
      id: newCompId, numero, fecha: v.fecha,
      glosa: `Venta (editada): ${producto.nombre} x${v.cantidad_vendida}`,
      estado: 'CONTABILIZADO', created_at: now, updated_at: now,
    };

    const newDets: ComprobanteDetalle[] = [
      ...v.cobros.map(cobro => ({
        id: generateId(), comprobante_id: newCompId, cuenta_id: cobro.cuenta_id,
        descripcion: `Cobro venta ${producto.nombre}`, debe: cobro.monto, haber: 0,
      })),
      { id: generateId(), comprobante_id: newCompId, cuenta_id: cIngreso.id, descripcion: `Ingreso venta ${producto.nombre}`, debe: 0, haber: v.total_venta },
      { id: generateId(), comprobante_id: newCompId, cuenta_id: cCostoVentas.id, descripcion: `Costo de ventas ${producto.nombre}`, debe: costoTotal, haber: 0 },
      { id: generateId(), comprobante_id: newCompId, cuenta_id: cProdTerm.id, descripcion: `Salida inventario ${producto.nombre}`, debe: 0, haber: costoTotal },
    ];

    setState(s => {
      let newStock = s.stock.map(st => {
        if (st.producto_id !== ventaOriginal.producto_id) return st;
        const nc = st.cantidad_actual + ventaOriginal.cantidad_vendida;
        const nv = st.valor_actual + ventaOriginal.costo_total_venta;
        return { ...st, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: now };
      });
      newStock = newStock.map(st => {
        if (st.producto_id !== v.producto_id) return st;
        const nc = st.cantidad_actual - v.cantidad_vendida;
        const nv = st.valor_actual - costoTotal;
        return { ...st, cantidad_actual: nc, valor_actual: nv, costo_promedio: nc > 0 ? nv / nc : 0, updated_at: now };
      });
      return {
        ...s, stock: newStock,
        comprobantes: [...s.comprobantes.map(c => c.id === ventaOriginal.comprobante_id ? { ...c, deleted_at: now } : c), newComp],
        detalles: [...s.detalles, ...newDets],
        ventas: s.ventas.map(vt => vt.id === id ? {
          ...vt, fecha: v.fecha, producto_id: v.producto_id, cantidad_vendida: v.cantidad_vendida,
          total_venta: v.total_venta, costo_total_venta: costoTotal, costo_unitario_aplicado: newCPP,
          margen, margen_porcentaje: margenPct, forma_cobro_cuenta_id: v.cobros[0]?.cuenta_id || '',
          cobros: v.cobros, cuenta_ingreso_id: cIngreso.id, comprobante_id: newCompId,
        } : vt),
      };
    });
    return true;
  }, [state, isMesCerrado]);

  const recalcularCostosVentas = useCallback(() => {
    setState(s => {
      const ventasCorregidas = s.ventas.map(venta => {
        if (venta.estado !== 'ACTIVA' || venta.deleted_at) return venta;

        const produccion = s.producciones
          .filter(p => p.producto_id === venta.producto_id && p.estado === 'CONFIRMADA' && !p.deleted_at && p.fecha <= venta.fecha)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

        const costoUnitario = produccion?.costo_unitario ?? venta.costo_unitario_aplicado;
        const costoTotal = costoUnitario * venta.cantidad_vendida;
        const margen = venta.total_venta - costoTotal;
        const margenPct = venta.total_venta > 0 ? (margen / venta.total_venta) * 100 : 0;

        return { ...venta, costo_unitario_aplicado: costoUnitario, costo_total_venta: costoTotal, margen, margen_porcentaje: margenPct };
      });

      const detallesCorregidos = s.detalles.map(d => {
        const venta = ventasCorregidas.find(v => v.comprobante_id === d.comprobante_id);
        if (!venta) return d;
        const ventaOriginal = s.ventas.find(v => v.comprobante_id === d.comprobante_id);
        if (!ventaOriginal) return d;
        const cCostoVentas = s.cuentas.find(c => c.codigo === 'G1.7');
        const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');
        if (cCostoVentas && d.cuenta_id === cCostoVentas.id) return { ...d, debe: venta.costo_total_venta, haber: 0 };
        if (cProdTerm && d.cuenta_id === cProdTerm.id) return { ...d, debe: 0, haber: venta.costo_total_venta };
        return d;
      });

      return { ...s, ventas: ventasCorregidas, detalles: detallesCorregidos };
    });
  }, []);

  const updateStockMinimo = useCallback((producto_id: string, minimo: number) => {
    setState(s => ({ ...s, stock: s.stock.map(st => st.producto_id === producto_id ? { ...st, stock_minimo: minimo } : st) }));
  }, []);

  const cerrarMes = useCallback((anio: number, mes: number, nota?: string) => {
    setState(s => {
      const existing = s.cierres.find(c => c.anio === anio && c.mes === mes);
      if (existing) {
        return { ...s, cierres: s.cierres.map(c => c.anio === anio && c.mes === mes ? { ...c, cerrado: true, fecha_cierre: new Date().toISOString(), nota } : c) };
      }
      return { ...s, cierres: [...s.cierres, { id: generateId(), anio, mes, cerrado: true, fecha_cierre: new Date().toISOString(), nota }] };
    });
  }, []);

  const reabrirMes = useCallback((anio: number, mes: number) => {
    setState(s => ({ ...s, cierres: s.cierres.map(c => c.anio === anio && c.mes === mes ? { ...c, cerrado: false } : c) }));
  }, []);

  const value: AccountingContextType = {
    ...state,
    addCuenta, updateCuenta,
    addComprobante, updateComprobante, deleteComprobante, contabilizar, pasarABorrador,
    addInsumo, updateInsumo, deleteInsumo,
    addMovimientoInsumo, editMovimientoInsumo, deleteMovimientoInsumo,
    addReceta, updateReceta, deleteReceta, getRecetaInsumos, calcularCostoReceta,
    addProduccion, confirmarProduccion, eliminarProduccion, editarProduccion, canModifyProduccion,
    registrarVenta, eliminarVenta, editarVenta, recalcularCostosVentas, updateStockMinimo,
    cerrarMes, reabrirMes, isMesCerrado,
    getCuenta, getCuentaByCodigo, getProducto, getInsumo, getStockForProducto, getStockForInsumo,
    getDetallesForComprobante, getComprobantesContabilizados, getDetallesContabilizados,
  };

  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccounting() {
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error('useAccounting must be used within AccountingProvider');
  return ctx;
}

  // ==================== PRODUCTOS ====================
  const addProducto = useCallback((nombre: string) => {
    setState(s => {
      const codigo = getNextIngresoCodigo(s.cuentas);
      const cuentaId = generateId();
      const newCuenta: Cuenta = {
        id: cuentaId, codigo, nombre: `Venta de ${nombre}`, tipo: 'INGRESO',
        naturaleza: 'ACREEDORA', aumenta_en: 'HABER', disminuye_en: 'DEBE',
        es_caja_banco: false, activa: true,
      };
      const productoId = generateId();
      const newProducto: Producto = { id: productoId, nombre, cuenta_ingreso_id: cuentaId, activo: true };
      const newStock: StockProducto = {
        id: generateId(), producto_id: productoId,
        cantidad_actual: 0, valor_actual: 0, costo_promedio: 0, stock_minimo: 0,
        updated_at: new Date().toISOString(),
      };
      return {
        ...s,
        cuentas: [...s.cuentas, newCuenta],
        productos: [...s.productos, newProducto],
        stock: [...s.stock, newStock],
      };
    });
  }, []);

  // ==================== PRODUCTOS ====================
  const addProducto = useCallback((nombre: string) => {
    setState(s => {
      const codigo = getNextIngresoCodigo(s.cuentas);
      const cuentaId = generateId();
      const newCuenta: Cuenta = {
        id: cuentaId, codigo, nombre: `Venta de ${nombre}`, tipo: 'INGRESO',
        naturaleza: 'ACREEDORA', aumenta_en: 'HABER', disminuye_en: 'DEBE',
        es_caja_banco: false, activa: true,
      };
      const productoId = generateId();
      const newProducto: Producto = { id: productoId, nombre, cuenta_ingreso_id: cuentaId, activo: true };
      const newStock: StockProducto = {
        id: generateId(), producto_id: productoId,
        cantidad_actual: 0, valor_actual: 0, costo_promedio: 0, stock_minimo: 0,
        updated_at: new Date().toISOString(),
      };
      return {
        ...s,
        cuentas: [...s.cuentas, newCuenta],
        productos: [...s.productos, newProducto],
        stock: [...s.stock, newStock],
      };
    });
  }, []);

