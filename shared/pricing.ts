import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

type Coupon = 'NONE' | 'SAVE10' | 'FREESHIP'

function priceOf(productId: string, catalog: readonly Product[]): number {
  const product = catalog.find((candidate) => candidate.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product.priceCents
}

function assertValidQuantity(quantity: number): void {
  const isValid = Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY
  if (!isValid) {
    throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
  }
}

export function calculateSubtotal(items: CartItem[], catalog: readonly Product[] = PRODUCTS): number {
  let subtotal = 0
  for (const item of items) {
    assertValidQuantity(item.quantity)
    subtotal += priceOf(item.productId, catalog) * item.quantity
  }
  return subtotal
}

export function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode === undefined || couponCode === null) return 'NONE'
  const normalized = normalizeCouponCode(couponCode)
  if (normalized === '') return 'NONE'
  if (normalized === 'SAVE10') return 'SAVE10'
  if (normalized === 'FREESHIP') return 'FREESHIP'
  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

export function calculateDiscount(subtotal: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10' || subtotal <= 0) return 0
  return Math.floor((subtotal * 10 + 50) / 100)
}

export function calculateShipping(subtotal: number, discount: number, coupon: Coupon): number {
  if (subtotal === 0 || coupon === 'FREESHIP') return 0
  return subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_COST_CENTS
}

export function calculateTotal(subtotal: number, discount: number, shipping: number): number {
  return subtotal - discount + shipping
}

export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotal = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discount = calculateDiscount(subtotal, coupon)
  const shipping = calculateShipping(subtotal, discount, coupon)
  const total = calculateTotal(subtotal, discount, shipping)

  return { subtotalCents: subtotal, discountCents: discount, shippingCents: shipping, totalCents: total }
}