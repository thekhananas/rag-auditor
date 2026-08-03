export const PRESET_CORPUS = [
  "Rate limit exceeded: 429 Too Many Requests. Retry after 12 seconds.",
  "Authentication token invalid. Use Bearer scheme in Authorization header.",
  "Webhook signature verification failed. Ensure your signing secret is correct.",
  "Charge creation requires amount (in cents) and currency (e.g., 'usd').",
  "The exponential backoff algorithm is recommended for handling 429 responses.",
  "Use idempotency keys to safely retry requests without duplicating charges.",
  "Set the Stripe-Version header to 2024-09-01.acacia to opt into the latest API.",
  "Webhook endpoints must return a 200 HTTP status within 5 seconds.",
  "Metadata keys can be up to 40 characters, values up to 500 characters.",
  "PCI compliance requires using Stripe.js or Elements on the client side.",
  "Customer objects can have multiple payment methods attached.",
  "Subscription statuses include trialing, active, past_due, unpaid, and canceled.",
];
