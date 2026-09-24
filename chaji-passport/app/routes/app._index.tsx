import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  importProposedProfiles,
  listTeaProfiles,
  type ImportResult,
} from "../models/tea-profiles.server";
import { PROPOSED_TEA_PROFILES } from "../data/proposed-tea-profiles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const profiles = await listTeaProfiles(admin);
  return {
    profiles,
    proposedCount: PROPOSED_TEA_PROFILES.length,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") !== "import-proposed") {
    return { error: "Unknown action" };
  }
  return { result: await importProposedProfiles(admin) };
};

export default function Index() {
  const { profiles, proposedCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ result?: ImportResult; error?: string }>();
  const importing = fetcher.state !== "idle";
  const result = fetcher.data?.result;

  const verified = profiles.filter((p) => p.verified).length;
  const live = profiles.filter((p) => p.verified && p.available).length;

  return (
    <s-page heading="Chaji Passport">
      <s-section heading="Tea profiles">
        <s-paragraph>
          The tea wheel and the café passport use these flavour scores. Customers
          only see teas that are marked <s-text type="strong">Owner verified</s-text>{" "}
          and are in stock.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-badge>{profiles.length} profiles</s-badge>
          <s-badge tone={verified ? "success" : "warning"}>{verified} verified</s-badge>
          <s-badge tone={live ? "success" : "neutral"}>{live} live on the wheel</s-badge>
        </s-stack>

        {profiles.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>
              No profiles yet. Import the {proposedCount} proposed profiles. They are
              based on each product&rsquo;s description, arrive unverified, and don&rsquo;t
              change anything customers can see.
            </s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Tea</s-table-header>
              <s-table-header>Family</s-table-header>
              <s-table-header>Roast</s-table-header>
              <s-table-header>Umami</s-table-header>
              <s-table-header>Sweet</s-table-header>
              <s-table-header>Astringent</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {profiles.map((p) => (
                <s-table-row key={p.metaobjectId}>
                  <s-table-cell>{p.label}</s-table-cell>
                  <s-table-cell>{p.family}</s-table-cell>
                  <s-table-cell>{p.roast}</s-table-cell>
                  <s-table-cell>{p.umami}</s-table-cell>
                  <s-table-cell>{p.sweetness}</s-table-cell>
                  <s-table-cell>{p.astringency}</s-table-cell>
                  <s-table-cell>
                    {!p.available ? (
                      <s-badge tone="neutral">Not available</s-badge>
                    ) : p.verified ? (
                      <s-badge tone="success">Live</s-badge>
                    ) : (
                      <s-badge tone="warning">Needs review</s-badge>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="import-proposed" />
          <s-button type="submit" loading={importing || undefined}>
            Import proposed profiles
          </s-button>
        </fetcher.Form>

        {result && (
          <s-banner tone={result.errors.length ? "warning" : "success"}>
            Created {result.created.length}, kept {result.skippedExisting.length} existing
            {result.missingProducts.length > 0 &&
              `, no product found for: ${result.missingProducts.join(", ")}`}
            {result.errors.length > 0 && `. Errors: ${result.errors.join(" | ")}`}
          </s-banner>
        )}
      </s-section>

      <s-section slot="aside" heading="How to review">
        <s-ordered-list>
          <s-list-item>Open Content → Metaobjects → Tea profile.</s-list-item>
          <s-list-item>Adjust the scores to match how the tea really tastes.</s-list-item>
          <s-list-item>Add a brew guide, then tick Owner verified.</s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section slot="aside" heading="Build status">
        <s-unordered-list>
          <s-list-item>Phase 1: data model, core logic ✔</s-list-item>
          <s-list-item>Phase 2: café table passport</s-list-item>
          <s-list-item>Phase 3: Roast &amp; Umami Wheel</s-list-item>
          <s-list-item>Phase 4: HoReCa reorder desk</s-list-item>
          <s-list-item>Phase 5: events scrapbook, rewards</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
