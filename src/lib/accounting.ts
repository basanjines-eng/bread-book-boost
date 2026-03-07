import type { Cuenta, Producto, StockProducto, Insumo, StockInsumo } from '@/types/accounting';

export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function generateNumero(date: string, existingCount: number): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `DG-${yyyy}-${mm}-${seq}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function getInitialCuentas(): Cuenta[] {
  const make = (codigo: string, nombre: string, tipo: Cuenta['tipo'], esCaja = false): Cuenta => {
    const isDeudora = tipo === 'ACTIVO' || tipo === 'GASTO';
    return {
      id: generateId(), codigo, nombre, tipo,
      naturaleza: isDeudora ? 'DEUDORA' : 'ACREEDORA',
      aumenta_en: isDeudora ? 'DEBE' : 'HABER',
      disminuye_en: isDeudora ? 'HABER' : 'DEBE',
      es_caja_banco: esCaja, activa: true,
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
    make('P1.4', 'Anticipo de Clientes', 'PASIVO'),
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

export function getCuentaIngresoForProducto(productoNombre: string): string {
  const map: Record<string, string> = {
    'Pan': 'I1.1',
    'Queque de Plátano': 'I1.2',
    'Queque de Naranja': 'I1.3',
  };
  return map[productoNombre] || 'I1.1';
}

// ==================== INSUMOS INICIALES ====================
type InsumoInit = {
  nombre: string;
  categoria: Insumo['categoria'];
  unidad_base: string;
  unidad_compra_habitual: string;
  equivalencia_compra: number;
};

const INSUMOS_INICIALES: InsumoInit[] = [
  { nombre: 'Harina', categoria: 'Ingredientes', unidad_base: 'kg', unidad_compra_habitual: 'bolsa', equivalencia_compra: 25 },
  { nombre: 'Manteca', categoria: 'Ingredientes', unidad_base: 'kg', unidad_compra_habitual: 'balde', equivalencia_compra: 15 },
  { nombre: 'Huevo', categoria: 'Ingredientes', unidad_base: 'unidades', unidad_compra_habitual: 'maple', equivalencia_compra: 30 },
  { nombre: 'Leche', categoria: 'Ingredientes', unidad_base: 'bolsas', unidad_compra_habitual: 'bolsa', equivalencia_compra: 1 },
  { nombre: 'Queso', categoria: 'Ingredientes', unidad_base: 'unidades', unidad_compra_habitual: 'unidad', equivalencia_compra: 1 },
  { nombre: 'Levadura', categoria: 'Ingredientes', unidad_base: 'kg', unidad_compra_habitual: 'bolsa', equivalencia_compra: 1 },
  { nombre: 'Sal', categoria: 'Ingredientes', unidad_base: 'kg', unidad_compra_habitual: 'quintal', equivalencia_compra: 46 },
  { nombre: 'Azúcar', categoria: 'Ingredientes', unidad_base: 'kg', unidad_compra_habitual: 'quintal', equivalencia_compra: 46 },
  { nombre: 'Garrafas', categoria: 'Combustible', unidad_base: 'unidades', unidad_compra_habitual: 'garrafa', equivalencia_compra: 1 },
  { nombre: 'Bolsas', categoria: 'Empaque', unidad_base: 'unidades', unidad_compra_habitual: 'paquete', equivalencia_compra: 1 },
  { nombre: 'Plátano', categoria: 'Ingredientes', unidad_base: 'unidades', unidad_compra_habitual: 'unidad', equivalencia_compra: 1 },
  { nombre: 'Polvo para hornear', categoria: 'Ingredientes', unidad_base: 'cajas', unidad_compra_habitual: 'caja', equivalencia_compra: 1 },
  { nombre: 'Singani', categoria: 'Otros ingredientes', unidad_base: 'botellas', unidad_compra_habitual: 'botella', equivalencia_compra: 1 },
  { nombre: 'Aceite', categoria: 'Otros ingredientes', unidad_base: 'bidones', unidad_compra_habitual: 'bidón', equivalencia_compra: 1 },
  { nombre: 'Bicarbonato', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'paquete', equivalencia_compra: 1 },
  { nombre: 'Esencia de vainilla', categoria: 'Ingredientes', unidad_base: 'botellas', unidad_compra_habitual: 'botella', equivalencia_compra: 1 },
];

export function getInitialInsumos(): Insumo[] {
  const now = new Date().toISOString();
  return INSUMOS_INICIALES.map(i => ({
    id: generateId(),
    nombre: i.nombre,
    categoria: i.categoria,
    unidad_base: i.unidad_base,
    unidad_compra_habitual: i.unidad_compra_habitual,
    equivalencia_compra: i.equivalencia_compra,
    stock_minimo: 0,
    stock_ideal: 0,
    precio_unitario_referencia: 0,
    proveedor_habitual: '',
    observaciones: '',
    activo: true,
    created_at: now,
    updated_at: now,
  }));
}

export function getInitialStockInsumos(insumos: Insumo[]): StockInsumo[] {
  const now = new Date().toISOString();
  return insumos.map(i => ({
    id: generateId(),
    insumo_id: i.id,
    cantidad_actual: 0,
    valor_actual: 0,
    costo_promedio: 0,
    updated_at: now,
  }));
}
