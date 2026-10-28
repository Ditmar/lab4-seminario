
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

    const product = catalog.find(({ id }) => id === item.productId)

    if (!product) {
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
): { discount: number; freeShippingCoupon: boolean } {
  const normalizedCoupon = normalizeCouponCode(couponCode ?? '')

  if (normalizedCoupon === 'SAVE10') {
    const discount =
      subtotal > 0 ? Math.floor((subtotal * 10 + 50) / 100) : 0

    return { discount, freeShippingCoupon: false }
  }

  if (normalizedCoupon === 'FREESHIP') {
    return { discount: 0, freeShippingCoupon: true }
  }

 if (normalizedCoupon !== '') {
    throw new PricingError(
      'INVALID_COUPON',
      'El cupón "' + couponCode!.trim() + '" no es válido.',
    )
  }

  return { discount: 0, freeShippingCoupon: false }
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
  const { discount, freeShippingCoupon } = calculateDiscount(
    subtotal,
    couponCode,
  )
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
