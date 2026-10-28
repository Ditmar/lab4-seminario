import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

type Coupon = 'NONE' | 'SAVE10' | 'FREESHIP'

export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotalCents = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discountCents = calculateDiscount(subtotalCents, coupon)
  const shippingCents = calculateShipping(subtotalCents, discountCents, coupon)
  const totalCents = calculateTotal(subtotalCents, discountCents, shippingCents)

  return { subtotalCents, discountCents, shippingCents, totalCents }
}

function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  let subtotal = 0
  for (const item of items) {
    assertValidQuantity(item.quantity)
    subtotal += findPrice(item.productId, catalog) * item.quantity
  }
  return subtotal
}

function assertValidQuantity(quantity: number): void {
  const isValid = Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY
  if (!isValid) {
    throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
  }
}

function findPrice(productId: string, catalog: readonly Product[]): number {
  const product = catalog.find((candidate) => candidate.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product.priceCents
}

function parseCoupon(couponCode?: string | null): Coupon {
  if (couponCode === undefined || couponCode === null) return 'NONE'

  const code = normalizeCouponCode(couponCode)
  if (code === '') return 'NONE'
  if (code === 'SAVE10' || code === 'FREESHIP') return code

  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

function calculateDiscount(subtotal: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10') return 0
  // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
  return Math.floor((subtotal * 10 + 50) / 100)
}

function calculateShipping(subtotal: number, discount: number, coupon: Coupon): number {
  if (subtotal === 0) return 0
  if (coupon === 'FREESHIP') return 0
  return subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_COST_CENTS
}

function calculateTotal(subtotal: number, discount: number, shipping: number): number {
  return subtotal - discount + shipping
}