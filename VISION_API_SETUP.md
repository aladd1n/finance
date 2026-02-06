# Google Cloud Vision API Setup

This guide explains how to enable and configure Google Cloud Vision API for receipt scanning.

## Prerequisites

- Google Cloud Platform account (same account as OAuth)
- Google Cloud project (can use the same project as OAuth)

## Step 1: Enable Cloud Vision API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (same one used for OAuth)
3. Navigate to **APIs & Services > Library**
4. Search for "ho"
5. Click on "Cloud Vision API"
6. Click **Enable** button

## Step 2: Create API Key

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS** at the top
3. Select **API key**
4. A new API key will be generated
5. (Optional) Click **Edit API key** to restrict it:
   - Under "API restrictions", select "Restrict key"
   - Choose "Cloud Vision API" from the dropdown
   - Click **Save**

## Step 3: Configure Cloudflare Secret

Add the API key to your Cloudflare Worker:

```bash
# Set the Vision API key as a secret
npx wrangler secret put GOOGLE_VISION_API_KEY
# When prompted, paste your API key
```

Alternatively, for local development, add to `.dev.vars`:

```env
GOOGLE_VISION_API_KEY=your_api_key_here
```

## Step 4: Deploy Worker

Deploy the updated worker with Vision API support:

```bash
npx wrangler deploy
```

## How It Works

1. User uploads a receipt image from the Items page
2. Image is converted to base64 and sent to `/api/scan-receipt` endpoint
3. Worker calls Google Cloud Vision API with the image
4. Vision API returns text detected from the receipt
5. Text is parsed to extract item names and prices
6. Extracted items are shown in a preview
7. User can review and add all items with one click

## Supported Receipt Formats

The parser handles common receipt formats:
- Item name and price on same line: `Coffee 12.50`
- Item name and price separated: `Coffee    12.50`
- With quantity: `2x Coffee 25.00`
- Multi-line items (name on one line, price on next)

## Troubleshooting

### "Vision API key not configured" error
- Make sure you ran `npx wrangler secret put GOOGLE_VISION_API_KEY`
- Verify the secret is set: `npx wrangler secret list`

### "Failed to process receipt" error
- Check that Cloud Vision API is enabled in Google Cloud Console
- Verify API key has permission to use Cloud Vision API
- Check API key restrictions aren't blocking requests

### Items not extracted correctly
- Ensure receipt image is clear and well-lit
- Try taking photo from directly above the receipt
- Text should be horizontal and not skewed

## Pricing

Google Cloud Vision API pricing (as of 2026):
- First 1,000 requests per month: **FREE**
- Additional requests: $1.50 per 1,000 requests

For a bill-splitting app with occasional use, you'll likely stay within the free tier.

## Security Notes

- API key should be kept secret (use Cloudflare secrets, not committed to code)
- Consider adding rate limiting to prevent abuse
- API key is restricted to Cloud Vision API only for security
