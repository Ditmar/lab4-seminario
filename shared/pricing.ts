import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

export type CouponType = 'SAVE10' | 'FREESHIP' | null

/** Valida que la cantidad sea un entero entre 1 y MAX_QUANTITY. */
function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
  }
}

/** Busca un producto en el catálogo o lanza error si no existe. */
function findProduct(productId: string, catalog: readonly Product[]): Product {
  const product = catalog.find((p) => p.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product
}

/** Calcula el subtotal sumando precio × cantidad para cada elemento. */
export function calculateSubtotal(items: CartItem[], catalog: readonly Product[] = PRODUCTS): number {
  let subtotal = 0
  for (const item of items) {
    validateQuantity(item.quantity)
    const product = findProduct(item.productId, catalog)
    subtotal += product.priceCents * item.quantity
  }
  return subtotal
}

/** Parsea y valida el cupón proporcionado. */
export function parseCoupon(couponCode?: string | null): CouponType {
  if (couponCode === undefined || couponCode === null) {
    return null
  }
  const normalized = normalizeCouponCode(couponCode)
  if (normalized === '') {
    return null
  }
  if (normalized === 'SAVE10') {
    return 'SAVE10'
  }
  if (normalized === 'FREESHIP') {
    return 'FREESHIP'
  }
  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

/** Calcula el descuento en centavos según el cupón aplicado. */
export function calculateDiscount(subtotalCents: number, coupon: CouponType): number {
  if (coupon === 'SAVE10' && subtotalCents > 0) {
    // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
    return Math.floor((subtotalCents * 10 + 50) / 100)
  }
  return 0
}

/** Determina el costo de envío en función del subtotal neto y cupones. */
export function calculateShipping(
  subtotalAfterDiscount: number,
  coupon: CouponType,
  subtotalCents: number,
): number {
  if (subtotalCents === 0 || coupon === 'FREESHIP' || subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return 0
  }
  return SHIPPING_COST_CENTS
}

/** Calcula el total neto sumando envío y restando descuento. */
export function calculateTotal(subtotalCents: number, discountCents: number, shippingCents: number): number {
  return subtotalCents - discountCents + shippingCents
}

/**
 * Función principal de cálculo de precios refactorizada.
 * Orquesta funciones auxiliares puras manteniendo la misma interfaz pública.
 */
export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotalCents = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discountCents = calculateDiscount(subtotalCents, coupon)
  const subtotalAfterDiscount = subtotalCents - discountCents
  const shippingCents = calculateShipping(subtotalAfterDiscount, coupon, subtotalCents)
  const totalCents = calculateTotal(subtotalCents, discountCents, shippingCents)

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
  }
}
