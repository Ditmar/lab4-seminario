import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  let subtotal = 0
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) {
      throw new PricingError('INVALID_QUANTITY', 'La cantidad debe ser un entero entre 1 y ' + MAX_QUANTITY + '.')
    }
    let price = -1
    for (const product of catalog) {
      if (product.id === item.productId) price = product.priceCents
    }
    if (!(price >= 0)) {
      throw new PricingError('UNKNOWN_PRODUCT', 'El producto "' + item.productId + '" no existe.')
    }
    subtotal += price * item.quantity
  }
  return subtotal
}

type Coupon = 'SAVE10' | 'FREESHIP' | null

function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode === undefined || couponCode === null) return null
  const coupon = normalizeCouponCode(couponCode)
  if (coupon === '') return null
  if (coupon === 'SAVE10' || coupon === 'FREESHIP') return coupon
  throw new PricingError('INVALID_COUPON', 'El cupón "' + couponCode.trim() + '" no es válido.')
}

function calculateDiscount(subtotalCents: number, coupon: Coupon): number {
  // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
  return coupon === 'SAVE10' && subtotalCents > 0 ? Math.floor((subtotalCents * 10 + 50) / 100) : 0
}

function calculateShipping(subtotalCents: number, discountCents: number, coupon: Coupon): number {
  if (subtotalCents === 0 || coupon === 'FREESHIP') return 0
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
