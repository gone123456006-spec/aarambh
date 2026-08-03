import { Platform } from 'react-native';
import { apiFetch, ensureValidSession } from '@/utils/api';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'none';

export type SubscriptionSummary = {
  active: boolean;
  plan: string; // 'Free' | 'Pro'
  status: SubscriptionStatus;
  price: number;
  currency: string;
  durationDays: number;
  startDate: string | null;
  expiryDate: string | null;
  remainingDays: number;
  transactionId: string | null;
  razorpayConfigured?: boolean;
};

export type RazorpayOrder = {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  planName: string;
  planPrice: number;
  durationDays: number;
  description: string;
  name: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  themeColor?: string;
};

export const PRO_PRICE = 249;
export const PRO_PRICE_LABEL = '₹249/month';

export const FREE_SUBSCRIPTION: SubscriptionSummary = {
  active: false,
  plan: 'Free',
  status: 'none',
  price: PRO_PRICE,
  currency: 'INR',
  durationDays: 30,
  startDate: null,
  expiryDate: null,
  remainingDays: 0,
  transactionId: null,
  razorpayConfigured: false,
};

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutModule = {
  open: (options: Record<string, unknown>) => Promise<RazorpaySuccess>;
};

function loadRazorpayCheckout(): RazorpayCheckoutModule | null {
  try {
    // Native module — requires a development / release build (not Expo Go).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-razorpay');
    return (mod?.default ?? mod) as RazorpayCheckoutModule;
  } catch {
    return null;
  }
}

/** Fetch the signed-in user's current subscription status from the server. */
export async function fetchSubscription(): Promise<SubscriptionSummary> {
  const sessionOk = await ensureValidSession();
  if (!sessionOk) return FREE_SUBSCRIPTION;

  const res = await apiFetch<{ data: SubscriptionSummary }>('/api/subscription/me');
  return { ...FREE_SUBSCRIPTION, ...(res.data || {}) };
}

/** Create a Razorpay order for the Pro plan. */
export async function createRazorpayOrder(): Promise<RazorpayOrder> {
  const res = await apiFetch<{ data: RazorpayOrder }>('/api/subscription/create-order', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!res.data?.orderId || !res.data?.keyId) {
    throw new Error('Could not create Razorpay order. Please try again.');
  }
  return res.data;
}

/** Verify Razorpay payment on the server and activate Pro. */
export async function verifyRazorpayPayment(payload: RazorpaySuccess): Promise<SubscriptionSummary> {
  const res = await apiFetch<{ data: SubscriptionSummary }>('/api/subscription/verify-payment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ...FREE_SUBSCRIPTION, ...(res.data || {}) };
}

/**
 * Full Pro checkout: create order → open Razorpay → verify payment → activate.
 * Returns the updated subscription summary on success.
 * Throws on cancel / failure with a user-friendly message.
 */
export async function purchaseWithRazorpay(): Promise<SubscriptionSummary> {
  const order = await createRazorpayOrder();
  const RazorpayCheckout = loadRazorpayCheckout();

  if (!RazorpayCheckout?.open) {
    throw new Error(
      Platform.OS === 'web'
        ? 'Razorpay checkout is not available on web. Use the Android/iOS app.'
        : 'Razorpay needs a development build. Run a native rebuild (expo prebuild + expo run:android) — it does not work in Expo Go.'
    );
  }

  const options = {
    key: order.keyId,
    amount: String(order.amount),
    currency: order.currency || 'INR',
    name: order.name || "Ohm's English",
    description: order.description || 'Pro Subscription',
    order_id: order.orderId,
    prefill: {
      name: order.prefill?.name || '',
      email: order.prefill?.email || '',
      contact: order.prefill?.contact || '',
    },
    theme: { color: order.themeColor || '#e60000' },
  };

  let payment: RazorpaySuccess;
  try {
    payment = await RazorpayCheckout.open(options);
  } catch (err: unknown) {
    const e = err as { code?: number | string; description?: string; error?: { description?: string; reason?: string } };
    const code = e?.code;
    const description =
      e?.description ||
      e?.error?.description ||
      e?.error?.reason ||
      (typeof err === 'object' && err && 'message' in err ? String((err as { message?: string }).message) : '');

    // User closed the sheet / cancelled
    if (
      code === 0 ||
      code === '0' ||
      /cancel|cancelled|back.?pressed|user.?closed/i.test(String(description))
    ) {
      throw new Error('Payment cancelled');
    }

    throw new Error(description || 'Payment failed. Please try again.');
  }

  if (!payment?.razorpay_payment_id || !payment?.razorpay_order_id || !payment?.razorpay_signature) {
    throw new Error('Payment completed but details were incomplete. Contact support with your payment ID.');
  }

  return verifyRazorpayPayment({
    razorpay_order_id: payment.razorpay_order_id,
    razorpay_payment_id: payment.razorpay_payment_id,
    razorpay_signature: payment.razorpay_signature,
  });
}

/** Format an ISO date string as a short readable date (e.g. "17 Jul 2026"). */
export function formatSubscriptionDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
