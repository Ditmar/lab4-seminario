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

    const product = catalog.find(({ id }) => id === item.productId)
    if (!product || product.priceCents < 0) {
      throw new PricingError('UNKNOWN_PRODUCT', 'El producto "' + item.productId + '" no existe.')
    }

    subtotal += product.priceCents * item.quantity
  }

  return subtotal
}

type Coupon = 'SAVE10' | 'FREESHIP' | null

function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode === undefined || couponCode === null) return null

  const normalizedCode = normalizeCouponCode(couponCode)
  if (normalizedCode === '') return null
  if (normalizedCode === 'SAVE10' || normalizedCode === 'FREESHIP') return normalizedCode

  throw new PricingError('INVALID_COUPON', 'El cupón "' + couponCode.trim() + '" no es válido.')
}

function calculateDiscount(subtotal: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10' || subtotal === 0) return 0

  // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
  return Math.floor((subtotal * 10 + 50) / 100)
}

function calculateShipping(subtotal: number, discount: number, coupon: Coupon): number {
  if (subtotal === 0 || coupon === 'FREESHIP') return 0

  const discountedSubtotal = subtotal - discount
  return discountedSubtotal >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_COST_CENTS
}

function calculateTotal(subtotal: number, discount: number, shipping: number): number {
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

  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: calculateTotal(subtotal, discount, shipping),
  }
}
