import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

// VERSIÓN A (antes del refactor): funciona correctamente, pero es difícil de leer y mantener.
export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotal = calculateSubtotal(items, catalog)
  const { discount, freeShipping } = calculateDiscount(subtotal, couponCode)
  const shipping = calculateShipping(subtotal, discount, freeShipping)
  const total = calculateTotal(subtotal, discount, shipping)

  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: total,
  }
}

function calculateDiscount(subtotal: number, couponCode?: string | null) {
  let discount = 0
  let freeShipping = false
  const normalizedCoupon = couponCode == null ? '' : normalizeCouponCode(couponCode)

  if (normalizedCoupon === 'SAVE10') {
    if (subtotal > 0) {
      // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
      discount = Math.floor((subtotal * 10 + 50) / 100)
    }
  } else if (normalizedCoupon === 'FREESHIP') {
    freeShipping = true
  } else if (normalizedCoupon !== '') {
    throw new PricingError('INVALID_COUPON', 'El cupón "' + couponCode?.trim() + '" no es válido.')
  }

  return { discount, freeShipping }
}

function calculateShipping(subtotal: number, discount: number, freeShippingCoupon: boolean): number {
  if (subtotal === 0 || freeShippingCoupon || subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return SHIPPING_COST_CENTS
}

function calculateTotal(subtotal: number, discount: number, shipping: number): number {
  return subtotal - discount + shipping
}

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
    if (price < 0) {
      throw new PricingError('UNKNOWN_PRODUCT', 'El producto "' + item.productId + '" no existe.')
    }
    subtotal += price * item.quantity
  }
  return subtotal
}
