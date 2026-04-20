import type { MockOrder, MockOrderItem, OrderStatus } from "./types";

function item(
  partial: Omit<MockOrderItem, "id" | "line_total_gbp"> & { unit_price_gbp: number }
): MockOrderItem {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    ...partial,
    line_total_gbp: +(partial.unit_price_gbp * partial.qty).toFixed(2),
  };
}

function total(items: MockOrderItem[], shipping: number) {
  const sub = +items.reduce((s, i) => s + i.line_total_gbp, 0).toFixed(2);
  return { sub, total: +(sub + shipping).toFixed(2) };
}

const ord1Items: MockOrderItem[] = [
  item({ listing_id: "lst-001", card_name: "Specimen SSA-001", set_name: "Sample Set Alpha", variant: "graded", grading_company: "PSA", grade: "9", qty: 1, unit_price_gbp: 949 }),
];
const ord2Items: MockOrderItem[] = [
  item({ listing_id: "lst-007", card_name: "Specimen SSG-015", set_name: "Sample Set Gamma", variant: "raw", condition: "NM", qty: 2, unit_price_gbp: 38 }),
  item({ listing_id: "lst-010", card_name: "Specimen SSG-011", set_name: "Sample Set Gamma", variant: "raw", condition: "NM", qty: 24, unit_price_gbp: 0.5 }),
];
const ord3Items: MockOrderItem[] = [
  item({ listing_id: "lst-006", card_name: "Specimen SSB-006", set_name: "Sample Set Beta", variant: "raw", condition: "NM", qty: 1, unit_price_gbp: 95 }),
];
const ord4Items: MockOrderItem[] = [
  item({ listing_id: "lst-002", card_name: "Specimen SSA-005", set_name: "Sample Set Alpha", variant: "graded", grading_company: "PSA", grade: "10", qty: 1, unit_price_gbp: 3990 }),
];
const ord5Items: MockOrderItem[] = [
  item({ listing_id: "lst-009", card_name: "Specimen SSD-016", set_name: "Sample Set Delta", variant: "raw", condition: "NM", qty: 1, unit_price_gbp: 175 }),
];

function build(
  ref: string,
  buyer_name: string,
  buyer_email: string,
  status: OrderStatus,
  items: MockOrderItem[],
  shippingGbp: number,
  shippingMethod: MockOrder["shipping_method"],
  trackingNumber: string | null,
  placed_at: string,
  address: MockOrder["shipping_address"],
  payment_method: MockOrder["payment_method"] = "stripe_card"
): MockOrder {
  const { sub, total: t } = total(items, shippingGbp);
  return {
    id: ref,
    reference: ref,
    buyer_name,
    buyer_email,
    status,
    subtotal_gbp: sub,
    shipping_gbp: shippingGbp,
    total_gbp: t,
    payment_method,
    shipping_method: shippingMethod,
    shipping_address: address,
    tracking_number: trackingNumber,
    placed_at,
    items,
  };
}

export const MOCK_ORDERS: MockOrder[] = [
  build(
    "CB-ORD-2026-000017",
    "Hannah Reeves",
    "hannah@example.com",
    "shipped",
    ord1Items,
    9.95,
    "royal_mail_special",
    "QP123456789GB",
    "2026-04-17T16:14:00.000Z",
    { line1: "12 Rookery Lane", city: "Bath", postcode: "BA1 2AA", country: "GB" }
  ),
  build(
    "CB-ORD-2026-000016",
    "Daniel Park",
    "daniel@example.com",
    "paid",
    ord2Items,
    3.5,
    "royal_mail_tracked",
    null,
    "2026-04-18T10:01:00.000Z",
    { line1: "Flat 4, 88 Portman St", city: "Manchester", postcode: "M1 4AB", country: "GB" }
  ),
  build(
    "CB-ORD-2026-000015",
    "Yusuf Ahmed",
    "yusuf@example.com",
    "delivered",
    ord3Items,
    3.5,
    "royal_mail_tracked",
    "RM987654321GB",
    "2026-04-10T08:30:00.000Z",
    { line1: "3 Bramble Cottages", city: "York", postcode: "YO1 9LL", country: "GB" }
  ),
  build(
    "CB-ORD-2026-000014",
    "Sasha Patel",
    "sasha@example.com",
    "pending_payment",
    ord4Items,
    9.95,
    "royal_mail_special",
    null,
    "2026-04-19T07:42:00.000Z",
    { line1: "55 Riverside Walk", city: "Bristol", postcode: "BS1 6QZ", country: "GB" }
  ),
  build(
    "CB-ORD-2026-000013",
    "Will Tanner",
    "will@example.com",
    "packing",
    ord5Items,
    3.5,
    "royal_mail_tracked",
    null,
    "2026-04-18T19:55:00.000Z",
    { line1: "1 Oak Close", city: "Cardiff", postcode: "CF10 1AA", country: "GB" },
    "paypal_in"
  ),
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};
