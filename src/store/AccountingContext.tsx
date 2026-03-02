import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  Cuenta, Comprobante, ComprobanteDetalle, Producto,
  Produccion, StockProducto, Venta, CierreMensual
} from '@/types/accounting';
import {
  generateId, generateNumero, today,
  getInitialCuentas, getInitialProductos, getInitialStock,
  getCuentaIngresoForProducto
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
}

interface AccountingContextType extends AccountingState {
  // Cuentas
  addCuenta: (c: Omit<Cuenta, 'id'>) => void;
  updateCuenta: (c: Cuenta) => void;
  // Comprobantes
  addComprobante: (comp: Omit<Comprobante, 'id' | 'numero' | 'created_at' | 'updated_at'>, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => string;
  updateComprobante: (comp: Comprobante, dets: Omit<ComprobanteDetalle, 'id' | 'comprobante_id'>[]) => void;
  deleteComprobante: (id: string) => void;
  contabilizar: (id: string) => boolean;
  pasarABorrador: (id: string) => void;
  // Produccion
  addProduccion: (p: Omit<Produccion, 'id' | 'costo_unitario'>) => void;
  confirmarProduccion: (id: string) => void;
  // Ventas
  registrarVenta: (v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; forma_cobro_cuenta_id: string }) => string | null;
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
  getStockForProducto: (producto_id: string) => StockProducto | undefined;
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

function initState(): AccountingState {
  const saved = loadState();
  if (saved && saved.cuentas?.length > 0) return saved;
  const cuentas = getInitialCuentas();
  const productos = getInitialProductos();
  const stock = getInitialStock(productos);
  return { cuentas, comprobantes: [], detalles: [], productos, producciones: [], stock, ventas: [], cierres: [] };
}

export function AccountingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountingState>(initState);

  useEffect(() => { saveState(state); }, [state]);

  const getCuenta = useCallback((id: string) => state.cuentas.find(c => c.id === id), [state.cuentas]);
  const getCuentaByCodigo = useCallback((codigo: string) => state.cuentas.find(c => c.codigo === codigo), [state.cuentas]);
  const getProducto = useCallback((id: string) => state.productos.find(p => p.id === id), [state.productos]);
  const getStockForProducto = useCallback((pid: string) => state.stock.find(s => s.producto_id === pid), [state.stock]);
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

  const addCuenta = useCallback((c: Omit<Cuenta, 'id'>) => {
    setState(s => ({ ...s, cuentas: [...s.cuentas, { ...c, id: generateId() }] }));
  }, []);

  const updateCuenta = useCallback((c: Cuenta) => {
    setState(s => ({ ...s, cuentas: s.cuentas.map(x => x.id === c.id ? c : x) }));
  }, []);

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
    if (Math.abs(totalDebe - totalHaber) > 0.01) return false;
    if (dets.length === 0) return false;
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

  const addProduccion = useCallback((p: Omit<Produccion, 'id' | 'costo_unitario'>) => {
    const costo_unitario = p.cantidad_producida > 0 ? p.costo_total_produccion / p.cantidad_producida : 0;
    setState(s => ({ ...s, producciones: [...s.producciones, { ...p, id: generateId(), costo_unitario }] }));
  }, []);

  const confirmarProduccion = useCallback((id: string) => {
    setState(s => {
      const prod = s.producciones.find(p => p.id === id);
      if (!prod || prod.estado === 'CONFIRMADA') return s;

      // Update stock
      const newStock = s.stock.map(st => {
        if (st.producto_id !== prod.producto_id) return st;
        const newCant = st.cantidad_actual + prod.cantidad_producida;
        const newVal = st.valor_actual + prod.costo_total_produccion;
        return {
          ...st,
          cantidad_actual: newCant,
          valor_actual: newVal,
          costo_promedio: newCant > 0 ? newVal / newCant : 0,
          updated_at: new Date().toISOString(),
        };
      });

      // Create auto comprobante
      const cInsumos = s.cuentas.find(c => c.codigo === 'A1.6');
      const cProdTerm = s.cuentas.find(c => c.codigo === 'A1.7');
      if (!cInsumos || !cProdTerm) return s;

      const compId = generateId();
      const now = new Date().toISOString();
      const numero = generateNumero(prod.fecha, s.comprobantes.length);
      const producto = s.productos.find(p => p.id === prod.producto_id);

      const newComp: Comprobante = {
        id: compId, numero, fecha: prod.fecha,
        glosa: `Producción: ${producto?.nombre || ''} x${prod.cantidad_producida}`,
        estado: 'CONTABILIZADO', created_at: now, updated_at: now,
      };

      const newDets: ComprobanteDetalle[] = [
        { id: generateId(), comprobante_id: compId, cuenta_id: cProdTerm.id, descripcion: 'Inventario Producto Terminado', debe: prod.costo_total_produccion, haber: 0 },
        { id: generateId(), comprobante_id: compId, cuenta_id: cInsumos.id, descripcion: 'Inventario Insumos', debe: 0, haber: prod.costo_total_produccion },
      ];

      return {
        ...s,
        producciones: s.producciones.map(p => p.id === id ? { ...p, estado: 'CONFIRMADA' as const } : p),
        stock: newStock,
        comprobantes: [...s.comprobantes, newComp],
        detalles: [...s.detalles, ...newDets],
      };
    });
  }, []);

  const registrarVenta = useCallback((v: { fecha: string; producto_id: string; cantidad_vendida: number; total_venta: number; forma_cobro_cuenta_id: string }): string | null => {
    const stk = state.stock.find(s => s.producto_id === v.producto_id);
    if (!stk || stk.cantidad_actual < v.cantidad_vendida) return null;

    const producto = state.productos.find(p => p.id === v.producto_id);
    if (!producto) return null;

    const costoTotal = stk.costo_promedio * v.cantidad_vendida;
    const margen = v.total_venta - costoTotal;
    const margenPct = v.total_venta > 0 ? (margen / v.total_venta) * 100 : 0;

    const codigoIngreso = getCuentaIngresoForProducto(producto.nombre);
    const cIngreso = state.cuentas.find(c => c.codigo === codigoIngreso);
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
      { id: generateId(), comprobante_id: compId, cuenta_id: v.forma_cobro_cuenta_id, descripcion: `Cobro venta ${producto.nombre}`, debe: v.total_venta, haber: 0 },
      { id: generateId(), comprobante_id: compId, cuenta_id: cIngreso.id, descripcion: `Ingreso venta ${producto.nombre}`, debe: 0, haber: v.total_venta },
      { id: generateId(), comprobante_id: compId, cuenta_id: cCostoVentas.id, descripcion: `Costo de ventas ${producto.nombre}`, debe: costoTotal, haber: 0 },
      { id: generateId(), comprobante_id: compId, cuenta_id: cProdTerm.id, descripcion: `Salida inventario ${producto.nombre}`, debe: 0, haber: costoTotal },
    ];

    const newVenta: Venta = {
      id: ventaId, fecha: v.fecha, producto_id: v.producto_id,
      cantidad_vendida: v.cantidad_vendida, total_venta: v.total_venta,
      costo_total_venta: costoTotal, margen, margen_porcentaje: margenPct,
      forma_cobro_cuenta_id: v.forma_cobro_cuenta_id,
      cuenta_ingreso_id: cIngreso.id, comprobante_id: compId,
    };

    setState(s => {
      const newStock = s.stock.map(st => {
        if (st.producto_id !== v.producto_id) return st;
        const newCant = st.cantidad_actual - v.cantidad_vendida;
        const newVal = st.valor_actual - costoTotal;
        return {
          ...st,
          cantidad_actual: newCant,
          valor_actual: newVal,
          costo_promedio: newCant > 0 ? newVal / newCant : 0,
          updated_at: now,
        };
      });
      return {
        ...s,
        stock: newStock,
        comprobantes: [...s.comprobantes, newComp],
        detalles: [...s.detalles, ...newDets],
        ventas: [...s.ventas, newVenta],
      };
    });

    return ventaId;
  }, [state]);

  const updateStockMinimo = useCallback((producto_id: string, minimo: number) => {
    setState(s => ({
      ...s,
      stock: s.stock.map(st => st.producto_id === producto_id ? { ...st, stock_minimo: minimo } : st),
    }));
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
    setState(s => ({
      ...s,
      cierres: s.cierres.map(c => c.anio === anio && c.mes === mes ? { ...c, cerrado: false } : c),
    }));
  }, []);

  const value: AccountingContextType = {
    ...state,
    addCuenta, updateCuenta,
    addComprobante, updateComprobante, deleteComprobante, contabilizar, pasarABorrador,
    addProduccion, confirmarProduccion,
    registrarVenta, updateStockMinimo,
    cerrarMes, reabrirMes, isMesCerrado,
    getCuenta, getCuentaByCodigo, getProducto, getStockForProducto,
    getDetallesForComprobante, getComprobantesContabilizados, getDetallesContabilizados,
  };

  return <AccountingContext.Provider value={value}>{children}</AccountingContext.Provider>;
}

export function useAccounting() {
  const ctx = useContext(AccountingContext);
  if (!ctx) throw new Error('useAccounting must be used within AccountingProvider');
  return ctx;
}
