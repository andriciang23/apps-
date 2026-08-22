/** Shapes shared across modules. Anything the SDKs already type is used from there. */

/* ── WhatsApp webhook ──────────────────────────────────────────────────────── */

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
}

/* ── Ops bridge ────────────────────────────────────────────────────────────── */

/**
 * The ops tool contract.
 *
 * ran=false means the check did not happen — unknown, never all-clear. Keeping
 * `ran` separate from `ok` is the whole point of this type.
 */
export interface OpsResult {
  ok: boolean;
  ran: boolean;
  data?: unknown;
  reason?: string | null;
}

/* ── Shopify ───────────────────────────────────────────────────────────────── */

export interface ShopifyAddress {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  provinceCode?: string | null;
  zip?: string | null;
  country?: string | null;
  countryCode?: string | null;
  phone?: string | null;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ShopifyCustomer {
  id: string;
  name: string;
  email?: string;
  defaultAddress?: ShopifyAddress;
}

export interface VariantMatch {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  price: string;
  sku?: string;
  available?: number;
}

export interface DraftLineItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
}

export interface DraftOrderResult {
  name: string;
  invoiceUrl: string;
  totalPrice: string;
  shippingAddressPresent: boolean;
  billingAddressPresent: boolean;
}
