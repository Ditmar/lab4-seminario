import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

type Coupon = 'SAVE10' | 'FREESHIP' | null

function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
  }
}

function findProductPrice(productId: string, catalog: readonly Product[]): number {
  const product = catalog.find((item) => item.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product.priceCents
}

function calculateSubtotal(items: readonly CartItem[], catalog: readonly Product[]): number {
  let subtotalCents = 0
  for (const item of items) {
    validateQuantity(item.quantity)
    const priceCents = findProductPrice(item.productId, catalog)
    subtotalCents += priceCents * item.quantity
  }
  return subtotalCents
}

function parseCoupon(couponCode?: string | null): Coupon {
  if (!couponCode) {
    return null
  }
  const normalized = normalizeCouponCode(couponCode)
  if (normalized === '') {
    return null
  }
  if (normalized === 'SAVE10' || normalized === 'FREESHIP') {
    return normalized
  }
  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

function calculateDiscount(subtotalCents: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10' || subtotalCents === 0) {
    return 0
  }
  // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
  return Math.floor((subtotalCents * 10 + 50) / 100)
}

function calculateShipping(subtotalCents: number, discountCents: number, coupon: Coupon): number {
  if (subtotalCents === 0 || coupon === 'FREESHIP') {
    return 0
  }
  const subtotalAfterDiscount = subtotalCents - discountCents
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_COST_CENTS
}

function calculateTotal(subtotalCents: number, discountCents: number, shippingCents: number): number {
  return subtotalCents - discountCents + shippingCents
}

export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotalCents = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discountCents = calculateDiscount(subtotalCents, coupon)
  const shippingCents = calculateShipping(subtotalCents, discountCents, coupon)
  const totalCents = calculateTotal(subtotalCents, discountCents, shippingCents)

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
  }
}
