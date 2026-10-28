
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
  couponCode: string | null | undefined,
  subtotal: number,
): { discountCents: number; freeShippingCoupon: boolean } {
  let discountCents = 0
  let freeShippingCoupon = false

  if (couponCode === undefined || couponCode === null) {
    return { discountCents, freeShippingCoupon }
  }

  const normalizedCoupon = normalizeCouponCode(couponCode)

  if (normalizedCoupon === '') {
    return { discountCents, freeShippingCoupon }
  }

  if (normalizedCoupon === 'SAVE10') {
    if (subtotal > 0) {
      // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
      discountCents = Math.floor((subtotal * 10 + 50) / 100)
    }
  } else if (normalizedCoupon === 'FREESHIP') {
    freeShippingCoupon = true
  } else {
    throw new PricingError(
      'INVALID_COUPON',
      'El cupón "' + couponCode.trim() + '" no es válido.',
    )
  }

  return { discountCents, freeShippingCoupon }
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

  const { discountCents, freeShippingCoupon } = calculateDiscount(
    couponCode,
    subtotal,
  )

  const shipping = calculateShipping(
    subtotal,
    discountCents,
    freeShippingCoupon,
  )

  const total = calculateTotal(subtotal, discountCents, shipping)

  return {
    subtotalCents: subtotal,
    discountCents,
    shippingCents: shipping,
    totalCents: total,
  }
}
