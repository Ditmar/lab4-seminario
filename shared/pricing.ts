
import { PRODUCTS } from './catalog'
import { PricingError } from './errors'
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_QUANTITY,
  SHIPPING_COST_CENTS,
  normalizeCouponCode,
} from './rules'
import type { CartItem, PriceBreakdown, Product } from './types'

// Valida las cantidades y calcula el subtotal del carrito.
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

// Procesa el cupon y determina el descuento y envio gratis.
function calculateCoupon(
  couponCode: string | null | undefined,
  subtotal: number,
): { discount: number; freeShipping: boolean } {
  const code = couponCode == null ? '' : normalizeCouponCode(couponCode)

  if (code === '') {
    return { discount: 0, freeShipping: false }
  }

  if (code === 'SAVE10') {
    return {
      discount: subtotal > 0
        ? Math.floor((subtotal * 10 + 50) / 100)
        : 0,
      freeShipping: false,
    }
  }

  if (code === 'FREESHIP') {
    return { discount: 0, freeShipping: true }
  }

  throw new PricingError(
    'INVALID_COUPON',
    'El cupón "' + couponCode!.trim() + '" no es válido.',
  )
}

// Calcula el envio segun el total y el cupon aplicado.
function calculateShipping(
  subtotal: number,
  discount: number,
  freeShipping: boolean,
): number {
  if (subtotal === 0 || freeShipping) {
    return 0
  }

  if (subtotal - discount >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return 0
  }

  return SHIPPING_COST_CENTS
}

// Coordina los calculos y devuelve el desglose de precios.
export function calculatePricing(
  items: CartItem[],
  couponCode?: string | null,
  catalog: readonly Product[] = PRODUCTS,
): PriceBreakdown {
  const subtotal = calculateSubtotal(items, catalog)
  const { discount, freeShipping } = calculateCoupon(couponCode, subtotal)
  const shipping = calculateShipping(subtotal, discount, freeShipping)

  return {
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    totalCents: subtotal - discount + shipping,
  }
}

