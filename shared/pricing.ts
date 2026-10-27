import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import { FREE_SHIPPING_THRESHOLD_CENTS, MAX_QUANTITY, SHIPPING_COST_CENTS, normalizeCouponCode } from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

/** SAVE10 descuenta el 10% del subtotal. */
const SAVE10_PERCENT = 10

type Coupon = 'SAVE10' | 'FREESHIP' | null

function assertValidQuantity(quantity: number): void {
  const isValid = Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY
  if (!isValid) {
    throw new PricingError('INVALID_QUANTITY', `La cantidad debe ser un entero entre 1 y ${MAX_QUANTITY}.`)
  }
}

function findPriceCents(productId: string, catalog: readonly Product[]): number {
  const product = catalog.find((candidate) => candidate.id === productId)
  if (!product) {
    throw new PricingError('UNKNOWN_PRODUCT', `El producto "${productId}" no existe.`)
  }
  return product.priceCents
}

/** Suma precio × cantidad de cada línea, validando cantidad y producto línea por línea. */
function calculateSubtotal(items: CartItem[], catalog: readonly Product[]): number {
  return items.reduce((subtotal, item) => {
    assertValidQuantity(item.quantity)
    return subtotal + findPriceCents(item.productId, catalog) * item.quantity
  }, 0)
}

/** Convierte el texto del cupón en un cupón conocido (o null si no hay cupón). Lanza si es inválido. */
function parseCoupon(couponCode?: string | null): Coupon {
  if (!couponCode) return null // undefined, null o cadena vacía
  const code = normalizeCouponCode(couponCode)
  if (code === '') return null // solo espacios
  if (code === 'SAVE10' || code === 'FREESHIP') return code
  throw new PricingError('INVALID_COUPON', `El cupón "${couponCode.trim()}" no es válido.`)
}

function calculateDiscount(subtotalCents: number, coupon: Coupon): number {
  if (coupon !== 'SAVE10') return 0
  // 10% del subtotal, redondeado al centavo más cercano (mitades hacia arriba).
  return Math.floor((subtotalCents * SAVE10_PERCENT + 50) / 100)
}

function calculateShipping(subtotalCents: number, discountCents: number, coupon: Coupon): number {
  if (subtotalCents === 0) return 0
  if (coupon === 'FREESHIP') return 0
  const qualifiesForFreeShipping = subtotalCents - discountCents >= FREE_SHIPPING_THRESHOLD_CENTS
  return qualifiesForFreeShipping ? 0 : SHIPPING_COST_CENTS
}

function calculateTotal(subtotalCents: number, discountCents: number, shippingCents: number): number {
  return subtotalCents - discountCents + shippingCents
}

export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  // El orden importa: los errores de los ítems se lanzan antes que los del cupón.
  const subtotalCents = calculateSubtotal(items, catalog)
  const coupon = parseCoupon(couponCode)
  const discountCents = calculateDiscount(subtotalCents, coupon)
  const shippingCents = calculateShipping(subtotalCents, discountCents, coupon)

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: calculateTotal(subtotalCents, discountCents, shippingCents),
  }
}