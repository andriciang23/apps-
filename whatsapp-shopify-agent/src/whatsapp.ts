const GRAPH_API_VERSION = "v20.0";

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set");
  }
  return { accessToken, phoneNumberId };
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const { accessToken, phoneNumberId } = getConfig();
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${errText}`);
  }
}
