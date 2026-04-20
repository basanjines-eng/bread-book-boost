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
type InsumoInit = {
  nombre: string;
  categoria: Insumo['categoria'];
  unidad_base: string;
  unidad_compra_habitual: string;
  equivalencia_compra: number;
};

const INSUMOS_INICIALES: InsumoInit[] = [
  { nombre: 'Harina', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'Bolsa', equivalencia_compra: 50000 },
  { nombre: 'Azúcar', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'Quintal', equivalencia_compra: 46000 },
  { nombre: 'Levadura', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'bolsa', equivalencia_compra: 1000 },
  { nombre: 'Manteca', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'balde', equivalencia_compra: 15000 },
  { nombre: 'Sal', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'Quintal', equivalencia_compra: 46000 },
  { nombre: 'Queso', categoria: 'Ingredientes', unidad_base: 'unidades', unidad_compra_habitual: 'unidad', equivalencia_compra: 1 },
  { nombre: 'Huevo', categoria: 'Ingredientes', unidad_base: 'unidades', unidad_compra_habitual: 'maple', equivalencia_compra: 30 },
  { nombre: 'Mantequilla', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'balde', equivalencia_compra: 15000 },
  { nombre: 'Leche', categoria: 'Ingredientes', unidad_base: 'bolsas', unidad_compra_habitual: 'bolsa', equivalencia_compra: 1 },
  { nombre: 'Plátano', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'unidad', equivalencia_compra: 120 },
  { nombre: 'Polvo para hornear', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'caja', equivalencia_compra: 500 },
  { nombre: 'Bicarbonato', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'paquete', equivalencia_compra: 500 },
  { nombre: 'Fruta abrillantada', categoria: 'Ingredientes', unidad_base: 'g', unidad_compra_habitual: 'bolsa', equivalencia_compra: 500 },
  { nombre: 'Aceite', categoria: 'Otros ingredientes', unidad_base: 'ml', unidad_compra_habitual: 'bidón', equivalencia_compra: 4900 },
  { nombre: 'Esencia de vainilla', categoria: 'Ingredientes', unidad_base: 'ml', unidad_compra_habitual: 'botella', equivalencia_compra: 1000 },
  { nombre: 'Singani', categoria: 'Otros ingredientes', unidad_base: 'ml', unidad_compra_habitual: 'botella', equivalencia_compra: 1000 },
  { nombre: 'Garrafas', categoria: 'Combustible', unidad_base: 'unidades', unidad_compra_habitual: 'garrafa', equivalencia_compra: 1 },
  { nombre: 'Bolsas', categoria: 'Empaque', unidad_base: 'unidades', unidad_compra_habitual: 'paquete', equivalencia_compra: 1 },
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

// ==================== RECETAS INICIALES ====================
export function getInitialRecetas(productos: Producto[], insumos: Insumo[]): { recetas: Receta[], recetaInsumos: RecetaInsumo[] } {
  const now = new Date().toISOString();
  const findInsumo = (nombre: string) => insumos.find(i => i.nombre === nombre);
  const findProducto = (nombre: string) => productos.find(p => p.nombre === nombre);

  const recetas: Receta[] = [];
  const recetaInsumos: RecetaInsumo[] = [];

  // Receta 1 — Masa de Pan
  const panProducto = findProducto('Pan');
  if (panProducto) {
    const recetaId = generateId();
    recetas.push({ id: recetaId, producto_id: panProducto.id, nombre_receta: 'Masa de Pan', activo: true, created_at: now, updated_at: now });
    const ingredientesPan: { nombre: string; cantidad: number; unidad: string }[] = [
      { nombre: 'Harina', cantidad: 4000, unidad: 'g' },
      { nombre: 'Azúcar', cantidad: 80, unidad: 'g' },
      { nombre: 'Levadura', cantidad: 48, unidad: 'g' },
      { nombre: 'Manteca', cantidad: 224, unidad: 'g' },
      { nombre: 'Sal', cantidad: 48, unidad: 'g' },
      { nombre: 'Queso', cantidad: 0.5, unidad: 'unidades' },
      { nombre: 'Huevo', cantidad: 10, unidad: 'unidades' },
      { nombre: 'Mantequilla', cantidad: 14, unidad: 'g' },
      { nombre: 'Leche', cantidad: 1, unidad: 'bolsas' },
    ];
    for (const ing of ingredientesPan) {
      const ins = findInsumo(ing.nombre);
      if (ins) {
        recetaInsumos.push({ id: generateId(), receta_id: recetaId, insumo_id: ins.id, cantidad_usada: ing.cantidad, unidad_medida: ing.unidad, created_at: now, updated_at: now });
      }
    }
  }

  // Receta 2 — Queque de Plátano
  const quequeProducto = findProducto('Queque de Plátano');
  if (quequeProducto) {
    const recetaId = generateId();
    recetas.push({ id: recetaId, producto_id: quequeProducto.id, nombre_receta: 'Queque de Plátano', activo: true, created_at: now, updated_at: now });
    const ingredientesQueque: { nombre: string; cantidad: number; unidad: string }[] = [
      { nombre: 'Harina', cantidad: 375, unidad: 'g' },
      { nombre: 'Azúcar', cantidad: 200, unidad: 'g' },
      { nombre: 'Plátano', cantidad: 360, unidad: 'g' },
      { nombre: 'Huevo', cantidad: 180, unidad: 'g' },
      { nombre: 'Polvo para hornear', cantidad: 12, unidad: 'g' },
      { nombre: 'Bicarbonato', cantidad: 5, unidad: 'g' },
      { nombre: 'Fruta abrillantada', cantidad: 20, unidad: 'g' },
      { nombre: 'Aceite', cantidad: 120, unidad: 'ml' },
      { nombre: 'Esencia de vainilla', cantidad: 5, unidad: 'ml' },
      { nombre: 'Singani', cantidad: 30, unidad: 'ml' },
    ];
    for (const ing of ingredientesQueque) {
      const ins = findInsumo(ing.nombre);
      if (ins) {
        recetaInsumos.push({ id: generateId(), receta_id: recetaId, insumo_id: ins.id, cantidad_usada: ing.cantidad, unidad_medida: ing.unidad, created_at: now, updated_at: now });
      }
    }
  }

  return { recetas, recetaInsumos };
}
