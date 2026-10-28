import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_QUANTITY,
  SHIPPING_COST_CENTS,
  normalizeCouponCode,
} from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

function calculateSubtotal(
  items: CartItem[],
  catalog: readonly Product[],
): number {
  let subtotal = 0

  for (const item of items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > MAX_QUANTITY
    ) {
      throw new PricingError(
        'INVALID_QUANTITY',
        'La cantidad debe ser un entero entre 1 y ' + MAX_QUANTITY + '.',
      )
    }

    let price = -1

    for (const product of catalog) {
      if (product.id === item.productId) {
        price = product.priceCents
      }
    }

    if (price < 0) {
      throw new PricingError(
        'UNKNOWN_PRODUCT',
        'El producto "' + item.productId + '" no existe.',
      )
    }

    subtotal += price * item.quantity
  }

  return subtotal
}

function calculateDiscount(
  subtotal: number,
  coupon: string,
): number {
  if (coupon !== 'SAVE10' || subtotal <= 0) {
    return 0
  }

  // Redondeo al centavo más cercano, con mitades hacia arriba.
  return Math.floor((subtotal * 10 + 50) / 100)
}

function calculateShipping(
  subtotal: number,
  discount: number,
  freeShippingCoupon: boolean,
): number {
  if (subtotal === 0 || freeShippingCoupon) {
    return 0
  }

  if (subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return 0
  }

  return SHIPPING_COST_CENTS
}

function calculateTotal(
  subtotal: number,
  discount: number,
  shipping: number,
): number {
  return subtotal - discount + shipping
}

export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotal = calculateSubtotal(items, catalog)
  const normalizedCoupon =
    couponCode == null ? '' : normalizeCouponCode(couponCode)

  let freeShippingCoupon = false

  if (normalizedCoupon === 'FREESHIP') {
    freeShippingCoupon = true
  } else if (normalizedCoupon !== '' && normalizedCoupon !== 'SAVE10') {
    throw new PricingError(
      'INVALID_COUPON',
      'El cupón "' + couponCode!.trim() + '" no es válido.',
    )
  }

  const discount = calculateDiscount(subtotal, normalizedCoupon)
  const shipping = calculateShipping(
    subtotal,
    discount,
    freeShippingCoupon,
  )
  const total = calculateTotal(subtotal, discount, shipping)

  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: total,
  }
}
