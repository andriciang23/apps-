export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

export interface ParsedOrderItem {
  product_query: string;
  quantity: number;
}

export interface ParsedOrder {
  is_order: boolean;
  customer_name?: string;
  items: ParsedOrderItem[];
  shipping_address?: string;
  notes?: string;
}

export interface MatchedLineItem {
  requested: ParsedOrderItem;
  matchedVariantId?: string;
  matchedTitle?: string;
  matchedPrice?: string;
  unmatched: boolean;
}
