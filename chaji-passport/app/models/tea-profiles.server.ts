import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { AXES, type TeaFamily, type TeaProfile } from "../lib/flavour";
import { PROPOSED_TEA_PROFILES } from "../data/proposed-tea-profiles";

type Admin = AdminApiContext;

const PROFILE_TYPE = "$app:tea_profile";

const LIST_PROFILES = `#graphql
  query ChajiTeaProfiles($after: String) {
    metaobjects(type: "$app:tea_profile", first: 100, after: $after) {
      nodes {
        id
        handle
        fields { key value }
        product: field(key: "product") {
          reference { ... on Product { id handle title status totalInventory } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

interface ProfileNode {
  id: string;
  handle: string;
  fields: { key: string; value: string | null }[];
  product: {
    reference: {
      id: string;
      handle: string;
      title: string;
      status: string;
      totalInventory: number | null;
    } | null;
  } | null;
}

export interface ProfileRow extends TeaProfile {
  metaobjectId: string;
  productTitle: string;
}

export async function listTeaProfiles(admin: Admin): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  let after: string | null = null;
  do {
    const res = await admin.graphql(LIST_PROFILES, { variables: { after } });
    const json = (await res.json()) as {
      data: { metaobjects: { nodes: ProfileNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };
    };
    const { nodes, pageInfo } = json.data.metaobjects;
    for (const node of nodes) {
      const row = toProfile(node);
      if (row) rows.push(row);
    }
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);
  return rows;
}

export function toProfile(node: ProfileNode): ProfileRow | null {
  const product = node.product?.reference;
  if (!product) return null;
  const f = Object.fromEntries(node.fields.map((x) => [x.key, x.value]));
  const num = (k: string) => {
    const n = Number(f[k]);
    return Number.isFinite(n) ? n : 0;
  };
  const taste = Object.fromEntries(AXES.map((a) => [a, num(a)])) as Record<(typeof AXES)[number], number>;
  return {
    ...taste,
    metaobjectId: node.id,
    productId: product.id,
    handle: product.handle,
    productTitle: product.title,
    label: f.label ?? product.title,
    family: (f.family as TeaFamily) ?? "hojicha",
    caffeine: (f.caffeine as TeaProfile["caffeine"]) ?? "medium",
    verified: f.verified === "true",
    // totalInventory is null for untracked products — treat those as available.
    available: product.status === "ACTIVE" && (product.totalInventory ?? 1) > 0,
  };
}

const PRODUCTS_BY_HANDLE = `#graphql
  query ChajiProductsByHandle($query: String!) {
    products(first: 50, query: $query) {
      nodes { id handle title status totalInventory }
    }
  }`;

const UPSERT_PROFILE = `#graphql
  mutation ChajiUpsertTeaProfile($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }`;

const LINK_PROFILE = `#graphql
  mutation ChajiLinkProfile($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key namespace }
      userErrors { field message code }
    }
  }`;

/** Metaobject handles must be ASCII; product handles here sometimes aren't. */
export function profileHandle(productHandle: string) {
  const ascii = productHandle
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `tea-${ascii}`;
}

export interface ImportResult {
  created: string[];
  skippedExisting: string[];
  missingProducts: string[];
  errors: string[];
}

/**
 * Creates the proposed profiles as UNVERIFIED entries. Never overwrites a
 * profile that already exists, so owner edits are safe from re-imports.
 * Only runs when the owner presses the import button in the app admin.
 */
export async function importProposedProfiles(admin: Admin): Promise<ImportResult> {
  const result: ImportResult = { created: [], skippedExisting: [], missingProducts: [], errors: [] };
  const existing = new Set((await listTeaProfiles(admin)).map((p) => p.handle));

  const query = PROPOSED_TEA_PROFILES.map((p) => `handle:'${p.handle.replace(/'/g, "\\'")}'`).join(" OR ");
  const res = await admin.graphql(PRODUCTS_BY_HANDLE, { variables: { query } });
  const json = (await res.json()) as { data: { products: { nodes: { id: string; handle: string }[] } } };
  const byHandle = new Map(json.data.products.nodes.map((n) => [n.handle, n.id]));

  for (const p of PROPOSED_TEA_PROFILES) {
    if (existing.has(p.handle)) {
      result.skippedExisting.push(p.handle);
      continue;
    }
    const productId = byHandle.get(p.handle);
    if (!productId) {
      result.missingProducts.push(p.handle);
      continue;
    }

    const up = await admin.graphql(UPSERT_PROFILE, {
      variables: {
        handle: { type: PROFILE_TYPE, handle: profileHandle(p.handle) },
        metaobject: {
          fields: [
            { key: "label", value: p.label },
            { key: "product", value: productId },
            { key: "family", value: p.family },
            ...AXES.map((a) => ({ key: a, value: String(p[a]) })),
            { key: "caffeine", value: p.caffeine },
            { key: "notes", value: p.notes },
            { key: "verified", value: "false" },
          ],
        },
      },
    });
    const upJson = (await up.json()) as {
      data: { metaobjectUpsert: { metaobject: { id: string } | null; userErrors: { message: string }[] } };
    };
    const { metaobject, userErrors } = upJson.data.metaobjectUpsert;
    if (!metaobject || userErrors.length) {
      result.errors.push(`${p.handle}: ${userErrors.map((e) => e.message).join("; ")}`);
      continue;
    }

    const link = await admin.graphql(LINK_PROFILE, {
      variables: {
        metafields: [
          { ownerId: productId, namespace: "$app", key: "tea_profile", type: "metaobject_reference", value: metaobject.id },
        ],
      },
    });
    const linkJson = (await link.json()) as { data: { metafieldsSet: { userErrors: { message: string }[] } } };
    const linkErrors = linkJson.data.metafieldsSet.userErrors;
    if (linkErrors.length) {
      result.errors.push(`${p.handle} (link): ${linkErrors.map((e) => e.message).join("; ")}`);
      continue;
    }
    result.created.push(p.handle);
  }
  return result;
}
