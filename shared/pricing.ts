import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

// VERSIÓN B (después del refactor): mismas reglas y mismos errores, divididos en
// funciones pequeñas con una sola responsabilidad cada una.

type Coupon = 'SAVE10' | 'FREESHIP' | null

const SAVE10_PERCENT = 10

export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotalCents = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discountCents = calculateDiscount(subtotalCents, coupon)
  const shippingCents = calculateShipping(subtotalCents, discountCents, coupon)

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: calculateTotal(subtotalCents, discountCents, shippingCents),
  }
}

/** Suma precio × cantidad de cada línea, validando cantidad y producto. */
export function calculateSubtotal(items: CartItem[], catalog: readonly Product[] = PRODUCTS): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item, catalog), 0)
}

function calculateLineTotal(item: CartItem, catalog: readonly Product[]): number {
  assertValidQuantity(item.quantity)
  return findPriceCents(item.productId, catalog) * item.quantity
}

function assertValidQuantity(quantity: number): void {
  const isValid = Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY
  if (!isValid) {
    throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
  }
}

function findPriceCents(productId: string, catalog: readonly Product[]): number {
  const product = catalog.find((candidate) => candidate.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product.priceCents
}

/** Traduce el código escrito por el usuario a un cupón conocido (o null si no hay cupón). */
export function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode == null) return null

  const normalized = normalizeCouponCode(couponCode)
  if (normalized === '') return null
  if (normalized === 'SAVE10' || normalized === 'FREESHIP') return normalized

  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

/** SAVE10: 10 % del subtotal, redondeado al centavo más cercano (mitades hacia arriba). */
export function calculateDiscount(subtotalCents: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10') return 0
  return Math.floor((subtotalCents * SAVE10_PERCENT + 50) / 100)
}

/** Envío gratis con carrito vacío, con FREESHIP o si el subtotal tras el descuento llega al umbral. */
export function calculateShipping(subtotalCents: number, discountCents: number, coupon: Coupon): number {
  if (subtotalCents === 0) return 0
  if (coupon === 'FREESHIP') return 0
  if (subtotalCents - discountCents >= FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return SHIPPING_COST_CENTS
}

export function calculateTotal(subtotalCents: number, discountCents: number, shippingCents: number): number {
  return subtotalCents - discountCents + shippingCents
}
