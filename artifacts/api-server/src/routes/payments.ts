import { Router } from "express";
import { db, analysesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreatePaypalOrderBody, CapturePaypalOrderBody } from "@workspace/api-zod";

const router = Router();

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal auth failed: ${response.status} ${text}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// POST /api/payments/create-order
router.post("/create-order", async (req, res) => {
  const bodyResult = CreatePaypalOrderBody.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { analysisId } = bodyResult.data;

  // Verify analysis exists
  try {
    const [analysis] = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.id, analysisId))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    if (analysis.isPremiumUnlocked) {
      return res.status(400).json({ error: "Premium already unlocked" });
    }
  } catch (err) {
    req.log.error({ err }, "DB lookup failed in create-order");
    return res.status(500).json({ error: "Internal server error" });
  }

  try {
    const accessToken = await getPaypalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: analysisId,
            amount: {
              currency_code: "USD",
              value: "10.00",
            },
            description: "ClipRank Premium Analysis Unlock",
          },
        ],
        application_context: {
          brand_name: "ClipRank",
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      req.log.error({ status: response.status, text }, "PayPal create-order failed");
      return res.status(502).json({ error: "PayPal order creation failed" });
    }

    const order = await response.json() as { id: string; status: string };
    return res.json({ orderId: order.id, status: order.status });
  } catch (err) {
    req.log.error({ err }, "PayPal create-order error");
    return res.status(500).json({ error: "Payment service error" });
  }
});

// POST /api/payments/capture-order
router.post("/capture-order", async (req, res) => {
  const bodyResult = CapturePaypalOrderBody.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { orderId, analysisId } = bodyResult.data;

  try {
    const accessToken = await getPaypalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      req.log.error({ status: response.status, text }, "PayPal capture failed");
      return res.status(502).json({ error: "PayPal capture failed" });
    }

    const capture = await response.json() as { id: string; status: string };

    if (capture.status !== "COMPLETED") {
      return res.status(402).json({ error: "Payment not completed", status: capture.status });
    }

    // Mark analysis as premium unlocked
    await db
      .update(analysesTable)
      .set({ isPremiumUnlocked: true, paypalOrderId: orderId })
      .where(eq(analysesTable.id, analysisId));

    return res.json({ success: true, status: capture.status });
  } catch (err) {
    req.log.error({ err }, "PayPal capture error");
    return res.status(500).json({ error: "Payment service error" });
  }
});

export default router;
