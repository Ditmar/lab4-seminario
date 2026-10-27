import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

interface DiscountResult {
  discountCents: number
  freeShipping: boolean
}

function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  return items.reduce((subtotal, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new PricingError('INVALID_QUANTITY', 'La cantidad debe ser un entero entre 1 y ' + MAX_QUANTITY + '.')
    }

    const product = catalog.find((candidate) => candidate.id === item.productId)
    if (!product || product.priceCents < 0) {
      throw new PricingError('UNKNOWN_PRODUCT', 'El producto "' + item.productId + '" no existe.')
    }

    return subtotal + product.priceCents * item.quantity
  }, 0)
}

function calculateDiscount(subtotalCents: number, couponCode?: string | null): DiscountResult {
  if (couponCode === undefined || couponCode === null || normalizeCouponCode(couponCode) === '') {
    return { discountCents: 0, freeShipping: false }
  }

  const normalizedCode = normalizeCouponCode(couponCode)
  if (normalizedCode === 'SAVE10') {
    // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
    const discountCents = subtotalCents > 0 ? Math.floor((subtotalCents * 10 + 50) / 100) : 0
    return { discountCents, freeShipping: false }
  }

  if (normalizedCode === 'FREESHIP') {
    return { discountCents: 0, freeShipping: true }
  }

  throw new PricingError('INVALID_COUPON', 'El cupón "' + couponCode.trim() + '" no es válido.')
}

function calculateShipping(subtotalCents: number, discountCents: number, freeShippingCoupon: boolean): number {
  if (subtotalCents === 0 || freeShippingCoupon) return 0
  return subtotalCents - discountCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_COST_CENTS
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
  const { discountCents, freeShipping } = calculateDiscount(subtotalCents, couponCode)
  const shippingCents = calculateShipping(subtotalCents, discountCents, freeShipping)

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: calculateTotal(subtotalCents, discountCents, shippingCents),
  }
}
