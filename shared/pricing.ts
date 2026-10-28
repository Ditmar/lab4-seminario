
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

    const product = catalog.find(
      (product) => product.id === item.productId,
    )

    if (!product || product.priceCents < 0) {
      throw new PricingError(
        'UNKNOWN_PRODUCT',
        'El producto "' + item.productId + '" no existe.',
      )
    }

    subtotal += product.priceCents * item.quantity
  }

  return subtotal
}

function calculateDiscount(
  subtotal: number,
  couponCode?: string | null,
): number {
  if (
    couponCode === undefined ||
    couponCode === null ||
    normalizeCouponCode(couponCode) === ''
  ) {
    return 0
  }

  const normalizedCoupon = normalizeCouponCode(couponCode)

  if (normalizedCoupon === 'SAVE10') {
    if (subtotal > 0) {
      // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
      return Math.floor((subtotal * 10 + 50) / 100)
    }

    return 0
  }

  if (normalizedCoupon === 'FREESHIP') {
    return 0
  }

  throw new PricingError(
    'INVALID_COUPON',
    'El cupón "' + couponCode.trim() + '" no es válido.',
  )
}

function calculateShipping(
  subtotal: number,
  discount: number,
  couponCode?: string | null,
): number {
  if (subtotal === 0) {
    return 0
  }

  if (
    couponCode !== undefined &&
    couponCode !== null &&
    normalizeCouponCode(couponCode) === 'FREESHIP'
  ) {
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
  const discount = calculateDiscount(subtotal, couponCode)
  const shipping = calculateShipping(subtotal, discount, couponCode)
  const total = calculateTotal(subtotal, discount, shipping)

  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: total,
  }
}
