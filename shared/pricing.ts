import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

type Coupon = 'SAVE10' | 'FREESHIP' | null

// VERSIÓN B (después del refactor): mismo comportamiento, dividido en funciones pequeñas.
// Orden importante: primero se validan todas las líneas del carrito y después el cupón.
export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotal = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discount = calculateDiscount(subtotal, coupon)
  const shipping = calculateShipping(subtotal, discount, coupon)

  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: calculateTotal(subtotal, discount, shipping),
  }
}

/** Suma precio × cantidad de cada línea. Valida cada línea (cantidad y luego producto) en orden. */
function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  let subtotal = 0
  for (const item of items) {
    validateQuantity(item.quantity)
    subtotal += findPriceCents(item.productId, catalog) * item.quantity
  }
  return subtotal
}

function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    throw new PricingError('INVALID_QUANTITY', 'La cantidad debe ser un entero entre 1 y ' + MAX_QUANTITY + '.')
  }
}

/**
 * Precio del producto en el catálogo. Si el id se repite, gana la última coincidencia.
 * Un precio 0 es válido; uno negativo se trata como producto inexistente.
 */
function findPriceCents(productId: string, catalog: readonly Product[]): number {
  let price = -1
  for (const product of catalog) {
    if (product.id === productId) price = product.priceCents
  }
  if (price < 0) {
    throw new PricingError('UNKNOWN_PRODUCT', 'El producto "' + productId + '" no existe.')
  }
  return price
}

/** Interpreta el cupón. Vacío o solo espacios equivale a no tener cupón. */
function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode === undefined || couponCode === null) return null
  const normalized = normalizeCouponCode(couponCode)
  if (normalized === '') return null
  if (normalized === 'SAVE10' || normalized === 'FREESHIP') return normalized
  throw new PricingError('INVALID_COUPON', 'El cupón "' + couponCode.trim() + '" no es válido.')
}

/** SAVE10: 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba). */
function calculateDiscount(subtotal: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10') return 0
  return Math.floor((subtotal * 10 + 50) / 100)
}

/** Gratis con carrito vacío, con FREESHIP o si el subtotal DESPUÉS del descuento alcanza el umbral. */
function calculateShipping(subtotal: number, discount: number, coupon: Coupon): number {
  if (subtotal === 0) return 0
  if (coupon === 'FREESHIP') return 0
  if (subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return SHIPPING_COST_CENTS
}

function calculateTotal(subtotal: number, discount: number, shipping: number): number {
  return subtotal - discount + shipping
}
