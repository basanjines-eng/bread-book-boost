import type { Cuenta, Producto, StockProducto, Insumo, StockInsumo, Receta, RecetaInsumo } from '@/types/accounting';

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
  const makeCustom = (codigo: string, nombre: string, tipo: Cuenta['tipo'], naturaleza: 'DEUDORA' | 'ACREEDORA'): Cuenta => ({
    id: generateId(), codigo, nombre, tipo, naturaleza,
    aumenta_en: naturaleza === 'DEUDORA' ? 'DEBE' : 'HABER',
    disminuye_en: naturaleza === 'DEUDORA' ? 'HABER' : 'DEBE',
    es_caja_banco: false, activa: true,
  });

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
    make('G1.8', 'Mermas de Producción', 'GASTO'),
    make('G1.9', 'Sueldos y Salarios', 'GASTO'),
    make('G1.10', 'Aportes Patronales', 'GASTO'),
    make('G1.11', 'Depreciación', 'GASTO'),
    make('P1.5', 'Sueldos por Pagar', 'PASIVO'),
    make('P1.6', 'AFP por Pagar', 'PASIVO'),
    make('P1.7', 'CNS por Pagar', 'PASIVO'),
    make('A2.1', 'Muebles y Enseres', 'ACTIVO'),
    make('A2.2', 'Maquinaria y Equipo', 'ACTIVO'),
    make('A2.3', 'Equipos de Cómputo', 'ACTIVO'),
    makeCustom('A2.9', 'Depreciación Acumulada', 'ACTIVO', 'ACREEDORA'),
  ];
}

export function getInitialProductos(_cuentas: Cuenta[]): Producto[] {
  // Sin productos demo — el usuario los crea desde cero.
  return [];
}

export function getNextIngresoCodigo(cuentas: Cuenta[]): string {
  const ingresoCuentas = cuentas.filter(c => c.tipo === 'INGRESO' && c.codigo.startsWith('I1.'));
  const nums = ingresoCuentas.map(c => parseInt(c.codigo.split('.')[1])).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `I1.${next}`;
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

// ==================== INSUMOS INICIALES ====================
// Sin insumos demo — el usuario crea los suyos desde cero.
export function getInitialInsumos(): Insumo[] {
  return [];
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

// ==================== RECETAS INICIALES ====================
// Sin recetas demo — el usuario crea las suyas desde cero.
export function getInitialRecetas(_productos: Producto[], _insumos: Insumo[]): { recetas: Receta[], recetaInsumos: RecetaInsumo[] } {
  return { recetas: [], recetaInsumos: [] };
}

// ==================== CONVERSIÓN FLEXIBLE DE UNIDADES ====================
// Conversor para unidades del mismo sistema métrico (g↔kg↔mg, l↔ml).
// Devuelve null si no se puede convertir automáticamente.
const UNIDADES_PESO_A_GRAMOS: Record<string, number> = {
  mg: 0.001, g: 1, gr: 1, gramo: 1, gramos: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, kilogramos: 1000,
  arroba: 11500, quintal: 46000,
};
const UNIDADES_VOLUMEN_A_ML: Record<string, number> = {
  ml: 1, mililitro: 1, mililitros: 1,
  l: 1000, lt: 1000, litro: 1000, litros: 1000,
  cucharadita: 5, cucharada: 15, taza: 240,
};

export function convertirUnidadFlexible(
  cantidad: number,
  unidadOrigen: string,
  unidadDestino: string,
  unidadCompraHabitual?: string,
  equivalenciaCompra?: number,
): number | null {
  const o = (unidadOrigen || '').toLowerCase().trim();
  const d = (unidadDestino || '').toLowerCase().trim();
  if (!o || !d) return null;
  if (o === d) return cantidad;

  // Mismo sistema métrico (peso)
  if (o in UNIDADES_PESO_A_GRAMOS && d in UNIDADES_PESO_A_GRAMOS) {
    return (cantidad * UNIDADES_PESO_A_GRAMOS[o]) / UNIDADES_PESO_A_GRAMOS[d];
  }
  // Mismo sistema métrico (volumen)
  if (o in UNIDADES_VOLUMEN_A_ML && d in UNIDADES_VOLUMEN_A_ML) {
    return (cantidad * UNIDADES_VOLUMEN_A_ML[o]) / UNIDADES_VOLUMEN_A_ML[d];
  }
  // Equivalencia personalizada del insumo (ej: 1 bolsa = 50000 g)
  if (unidadCompraHabitual && equivalenciaCompra && equivalenciaCompra > 0) {
    const uc = unidadCompraHabitual.toLowerCase().trim();
    if (o === uc) {
      // origen = unidad de compra → convertir a base usando equivalencia
      return cantidad * equivalenciaCompra;
    }
    if (d === uc) {
      // destino = unidad de compra → dividir por equivalencia
      return cantidad / equivalenciaCompra;
    }
  }
  return null;
}
