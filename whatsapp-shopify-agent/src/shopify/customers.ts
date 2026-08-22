import { shopifyGraphQL } from "./client.js";
import type { ShopifyAddress, ShopifyCustomer } from "../types.js";

/* ── Customers ─────────────────────────────────────────────────────────────── */

interface CustomerSearchResult {
  customers: {
    edges: Array<{
      node: {
        id: string;
        displayName: string;
        email: string | null;
        defaultAddress: ShopifyAddress | null;
      };
    }>;
  };
}

const ADDRESS_FIELDS = `address1 address2 city province provinceCode zip country countryCode phone company firstName lastName`;

const CUSTOMER_SEARCH = `
  query FindCustomer($query: String!) {
    customers(first: 5, query: $query) {
      edges { node { id displayName email defaultAddress { ${ADDRESS_FIELDS} } } }
    }
  }
`;

export async function findCustomer(query: string): Promise<ShopifyCustomer | undefined> {
  const escaped = query.replace(/['"\\]/g, " ").trim();
  const data = await shopifyGraphQL<CustomerSearchResult>(CUSTOMER_SEARCH, { query: escaped });
  const node = data.customers.edges[0]?.node;
  if (!node) return undefined;
  return {
    id: node.id,
    name: node.displayName,
    email: node.email ?? undefined,
    defaultAddress: node.defaultAddress ?? undefined,
  };
}

interface CustomerByIdResult {
  customer: {
    id: string;
    displayName: string;
    email: string | null;
    defaultAddress: ShopifyAddress | null;
  } | null;
}

const CUSTOMER_BY_ID = `
  query GetCustomer($id: ID!) {
    customer(id: $id) {
      id
      displayName
      email
      defaultAddress { ${ADDRESS_FIELDS} }
    }
  }
`;

/**
 * Fetch a customer by gid.
 *
 * Distinct from findCustomer, which runs a text search: passing a gid:// to the
 * search endpoint does not resolve it, so the draft-order path needs this.
 */
export async function getCustomerById(id: string): Promise<ShopifyCustomer | undefined> {
  const data = await shopifyGraphQL<CustomerByIdResult>(CUSTOMER_BY_ID, { id });
  const node = data.customer;
  if (!node) return undefined;
  return {
    id: node.id,
    name: node.displayName,
    email: node.email ?? undefined,
    defaultAddress: node.defaultAddress ?? undefined,
  };
}
