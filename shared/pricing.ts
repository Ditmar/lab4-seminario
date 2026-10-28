import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

type Coupon = 'SAVE10' | 'FREESHIP'

const SAVE10_PERCENT = 10

function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY
}

function findPriceCents(productId: string, catalog: readonly Product[]): number {
  const product = catalog.find((candidate) => candidate.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product.priceCents
}

function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  let subtotal = 0
  for (const item of items) {
    if (!isValidQuantity(item.quantity)) {
      throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
    }
    subtotal += findPriceCents(item.productId, catalog) * item.quantity
  }
  return subtotal
}

function parseCoupon(couponCode?: string | null): Coupon | null {
  if (couponCode === undefined || couponCode === null) return null

  const code = normalizeCouponCode(couponCode)
  if (code === '') return null
  if (code === 'SAVE10' || code === 'FREESHIP') return code

  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

function calculateDiscount(subtotal: number, coupon: Coupon | null): number {
  if (coupon !== 'SAVE10') return 0
  // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
  return Math.floor((subtotal * SAVE10_PERCENT + 50) / 100)
}

function calculateShipping(subtotal: number, discount: number, coupon: Coupon | null): number {
  if (subtotal === 0) return 0
  if (coupon === 'FREESHIP') return 0
  if (subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return SHIPPING_COST_CENTS
}

function calculateTotal(subtotal: number, discount: number, shipping: number): number {
  return subtotal - discount + shipping
}

// VERSIÓN A (antes del refactor): funciona correctamente, pero es difícil de leer y mantener.
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
