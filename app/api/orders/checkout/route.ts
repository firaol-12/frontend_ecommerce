import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// POST /api/orders/checkout — migrated from orderRoutes.js (behavior preserved,
// including the non-transactional sequence of the original).

export const dynamic = "force-dynamic";

function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${random}`;
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const {
      shipping_address_id,
      billing_address_id,
      shipping_method,
      notes,
      coupon_code,
    } = await req.json();

    if (!shipping_address_id || !billing_address_id) {
      return ok(
        { message: "shipping_address_id and billing_address_id are required." },
        400
      );
    }

    const cartItems = await query(
      `SELECT c.*, p.name, p.price, p.discount, p.stock
       FROM cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1`,
      [auth.userId]
    );

    if ((cartItems.rowCount ?? 0) === 0) {
      return ok({ message: "Cart is empty." }, 400);
    }

    let subtotal = 0;
    for (const item of cartItems.rows) {
      const itemPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
      subtotal += itemPrice * Number(item.quantity);
    }

    let discountAmount = 0;
    if (coupon_code) {
      const couponResult = await query(
        `SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`,
        [coupon_code]
      );

      if ((couponResult.rowCount ?? 0) > 0) {
        const coupon = couponResult.rows[0];
        if (coupon.discount_type === "percentage") {
          discountAmount = Math.min(
            (subtotal * Number(coupon.discount_value)) / 100,
            Number(coupon.max_discount || subtotal)
          );
        } else {
          discountAmount = Number(coupon.discount_value);
        }
      }
    }

    const shippingCost = 0;
    const taxAmount = subtotal * 0.08;
    const totalAmount = subtotal + shippingCost + taxAmount - discountAmount;

    const orderResult = await query(
      `INSERT INTO orders (
        order_number, user_id, shipping_address_id, billing_address_id,
        subtotal, shipping_cost, tax_amount, discount_amount, total_amount,
        shipping_method, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        generateOrderNumber(),
        auth.userId,
        shipping_address_id,
        billing_address_id,
        subtotal.toFixed(2),
        shippingCost.toFixed(2),
        taxAmount.toFixed(2),
        discountAmount.toFixed(2),
        totalAmount.toFixed(2),
        shipping_method || null,
        notes || null,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of cartItems.rows) {
      const itemPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.product_id,
          item.name,
          "",
          Number(item.quantity),
          itemPrice.toFixed(2),
          (itemPrice * Number(item.quantity)).toFixed(2),
        ]
      );

      await query(
        `UPDATE products SET stock = stock - $1, view_count = view_count + 1 WHERE id = $2`,
        [Number(item.quantity), item.product_id]
      );
    }

    await query(
      `INSERT INTO payments (order_id, amount, payment_method, status)
       VALUES ($1, $2, $3, 'pending')`,
      [order.id, totalAmount.toFixed(2), "credit_card"]
    );

    await query("DELETE FROM cart WHERE user_id = $1", [auth.userId]);

    return ok({ message: "Order created successfully", order }, 201);
  } catch (error) {
    return serverError("Order checkout failed", error);
  }
}
