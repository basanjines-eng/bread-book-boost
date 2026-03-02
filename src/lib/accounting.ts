import type { Cuenta, Producto, StockProducto } from '@/types/accounting';

// Simple UUID generator
export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Generate comprobante number
export function generateNumero(date: string, existingCount: number): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `DG-${yyyy}-${mm}-${seq}`;
}

// Format currency
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format date
export function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// Today ISO
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

// Initial accounts
export function getInitialCuentas(): Cuenta[] {
  const make = (codigo: string, nombre: string, tipo: Cuenta['tipo'], esCaja = false): Cuenta => {
    const isDeudora = tipo === 'ACTIVO' || tipo === 'GASTO';
    return {
      id: generateId(),
      codigo,
      nombre,
      tipo,
      naturaleza: isDeudora ? 'DEUDORA' : 'ACREEDORA',
      aumenta_en: isDeudora ? 'DEBE' : 'HABER',
      disminuye_en: isDeudora ? 'HABER' : 'DEBE',
      es_caja_banco: esCaja,
      activa: true,
    };
  };

  return [
    make('A1.1', 'Caja', 'ACTIVO', true),
    make('A1.2', 'Caja Chica 1', 'ACTIVO', true),
    make('A1.3', 'Caja Chica 2', 'ACTIVO', true),
    make('A1.4', 'Banco', 'ACTIVO', true),
    make('A1.5', 'Cuentas por Cobrar', 'ACTIVO'),
    make('A1.6', 'Inventario de Insumos', 'ACTIVO'),
    make('A1.7', 'Inventario de Producto Terminado', 'ACTIVO'),
    make('P1.1', 'Cuentas por Pagar', 'PASIVO'),
    make('P1.2', 'Préstamos de Personas', 'PASIVO'),
    make('P1.3', 'Préstamos Bancarios', 'PASIVO'),
    make('C1.1', 'Capital', 'PATRIMONIO'),
    make('C1.2', 'Utilidad Acumulada', 'PATRIMONIO'),
    make('C1.3', 'Retiros del Dueño', 'PATRIMONIO'),
    make('I1.1', 'Venta de Pan', 'INGRESO'),
    make('I1.2', 'Venta de Queque de Plátano', 'INGRESO'),
    make('I1.3', 'Venta de Queque de Naranja', 'INGRESO'),
    make('G1.1', 'Insumos', 'GASTO'),
    make('G1.2', 'Movilidad', 'GASTO'),
    make('G1.3', 'Servicios Básicos', 'GASTO'),
    make('G1.4', 'Alquiler', 'GASTO'),
    make('G1.5', 'Mantenimiento', 'GASTO'),
    make('G1.6', 'Gas', 'GASTO'),
    make('G1.7', 'Costo de Ventas', 'GASTO'),
  ];
}

export function getInitialProductos(): Producto[] {
  return [
    { id: generateId(), nombre: 'Pan', activo: true },
    { id: generateId(), nombre: 'Queque de Plátano', activo: true },
    { id: generateId(), nombre: 'Queque de Naranja', activo: true },
  ];
}

export function getInitialStock(productos: Producto[]): StockProducto[] {
  return productos.map((p) => ({
    id: generateId(),
    producto_id: p.id,
    cantidad_actual: 0,
    valor_actual: 0,
    costo_promedio: 0,
    stock_minimo: 0,
    updated_at: new Date().toISOString(),
  }));
}

// Map product name to income account code
export function getCuentaIngresoForProducto(productoNombre: string): string {
  const map: Record<string, string> = {
    'Pan': 'I1.1',
    'Queque de Plátano': 'I1.2',
    'Queque de Naranja': 'I1.3',
  };
  return map[productoNombre] || 'I1.1';
}
