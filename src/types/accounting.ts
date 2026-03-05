// ==================== ENUMS ====================
export type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
export type Naturaleza = 'DEUDORA' | 'ACREEDORA';
export type LadoContable = 'DEBE' | 'HABER';
export type EstadoComprobante = 'BORRADOR' | 'CONTABILIZADO';
export type EstadoProduccion = 'BORRADOR' | 'CONFIRMADA' | 'ANULADA';

// ==================== TABLES ====================
export interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: Naturaleza;
  aumenta_en: LadoContable;
  disminuye_en: LadoContable;
  es_caja_banco: boolean;
  activa: boolean;
}

export interface Comprobante {
  id: string;
  numero: string;
  fecha: string; // ISO date
  glosa: string;
  referencia?: string;
  estado: EstadoComprobante;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ComprobanteDetalle {
  id: string;
  comprobante_id: string;
  cuenta_id: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface Producto {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Produccion {
  id: string;
  fecha: string;
  producto_id: string;
  cantidad_producida: number;
  costo_total_produccion: number;
  costo_unitario: number;
  estado: EstadoProduccion;
  comprobante_id?: string;
  deleted_at?: string | null;
}

export interface StockProducto {
  id: string;
  producto_id: string;
  cantidad_actual: number;
  valor_actual: number;
  costo_promedio: number;
  stock_minimo: number;
  updated_at: string;
}

export type EstadoVenta = 'ACTIVA' | 'ANULADA';

export interface Venta {
  id: string;
  fecha: string;
  producto_id: string;
  cantidad_vendida: number;
  total_venta: number;
  costo_total_venta: number;
  costo_unitario_aplicado: number;
  margen: number;
  margen_porcentaje: number;
  forma_cobro_cuenta_id: string;
  cuenta_ingreso_id: string;
  comprobante_id: string;
  estado: EstadoVenta;
  deleted_at?: string | null;
}

export interface CierreMensual {
  id: string;
  anio: number;
  mes: number;
  cerrado: boolean;
  fecha_cierre?: string;
  nota?: string;
}

// ==================== HELPERS ====================
export function getNaturaleza(tipo: TipoCuenta): { naturaleza: Naturaleza; aumenta_en: LadoContable; disminuye_en: LadoContable } {
  if (tipo === 'ACTIVO' || tipo === 'GASTO') {
    return { naturaleza: 'DEUDORA', aumenta_en: 'DEBE', disminuye_en: 'HABER' };
  }
  return { naturaleza: 'ACREEDORA', aumenta_en: 'HABER', disminuye_en: 'DEBE' };
}
