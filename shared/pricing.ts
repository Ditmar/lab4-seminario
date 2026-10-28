import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

type Coupon = 'SAVE10' | 'FREESHIP' | null

function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  let subtotal = 0

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) {
      throw new PricingError('INVALID_QUANTITY', 'La cantidad debe ser un entero entre 1 y ' + MAX_QUANTITY + '.')
    }

    // Se conserva el último precio coincidente, igual que en la implementación original.
    let price = -1
    for (const product of catalog) {
      if (product.id === item.productId) price = product.priceCents
    }
    if (price < 0) {
      throw new PricingError('UNKNOWN_PRODUCT', 'El producto "' + item.productId + '" no existe.')
    }

    subtotal += price * item.quantity
  }

  return subtotal
}

function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode == null) return null

  const normalized = normalizeCouponCode(couponCode)
  if (normalized === '') return null
  if (normalized === 'SAVE10' || normalized === 'FREESHIP') return normalized

  throw new PricingError('INVALID_COUPON', 'El cupón "' + couponCode.trim() + '" no es válido.')
}

function calculateDiscount(subtotal: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10' || subtotal <= 0) return 0

  // 10% del subtotal; las mitades de centavo redondean hacia arriba.
  return Math.floor((subtotal * 10 + 50) / 100)
}

function calculateShipping(subtotal: number, discount: number, coupon: Coupon): number {
  if (subtotal === 0 || coupon === 'FREESHIP') return 0
  if (subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS) return 0

  return SHIPPING_COST_CENTS
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
