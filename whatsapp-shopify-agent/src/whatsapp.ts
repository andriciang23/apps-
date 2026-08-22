const GRAPH_API_VERSION = "v23.0";

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set");
  }
  return { accessToken, phoneNumberId };
}

function graphUrl(path: string): string {
  const { phoneNumberId } = getConfig();
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/${path}`;
}

async function post(url: string, body: BodyInit, headers: Record<string, string>) {
  const { accessToken } = getConfig();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, ...headers },
    body,
  });
  if (!res.ok) {
    throw new Error(`WhatsApp API failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  await post(
    graphUrl("messages"),
    JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    { "Content-Type": "application/json" }
  );
}

/**
 * Send a document.
 *
 * Uploaded to the media endpoint first rather than passed as a link: the files
 * being sent are the wholesale pricelist and pitch decks, and a link would need
 * them exposed on a public URL. Upload keeps them off the open internet.
 */
export async function sendWhatsAppDocument(
  to: string,
  file: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(file)], { type: mimeFor(filename) }), filename);

  const upload = await post(graphUrl("media"), form, {});
  const mediaId = upload.id;
  if (typeof mediaId !== "string") {
    throw new Error(`WhatsApp media upload returned no id: ${JSON.stringify(upload)}`);
  }

  await post(
    graphUrl("messages"),
    JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { id: mediaId, filename, ...(caption ? { caption } : {}) },
    }),
    { "Content-Type": "application/json" }
  );
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
};

function mimeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}
