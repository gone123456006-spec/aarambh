import { Platform } from 'react-native';
import { apiFetch, ensureValidSession } from '@/utils/api';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'none';
export type CategorySlug = 'beginner' | 'intermediate' | 'advanced';

export type SubscriptionPlan = {
  category: CategorySlug;
  title: string;
  price: number;
  currency: string;
  durationDays: number;
  enabled: boolean;
  requiresPayment: boolean;
};

export type CheckoutQuote = {
  category: CategorySlug;
  title: string;
  durationDays: number;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  couponCode: string | null;
  couponApplied: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
};

export type ActiveCategorySubscription = {
  category: string;
  planName: string;
  expiryDate: string | null;
  remainingDays: number;
  price: number;
};

export type SubscriptionSummary = {
  active: boolean;
  plan: string;
  category?: string | null;
  status: SubscriptionStatus;
  price: number;
  currency: string;
  durationDays: number;
  startDate: string | null;
  expiryDate: string | null;
  remainingDays: number;
  transactionId: string | null;
  couponCode?: string | null;
  originalPrice?: number | null;
  discountAmount?: number;
  razorpayConfigured?: boolean;
  plans: SubscriptionPlan[];
  access: Record<string, boolean>;
  activeSubscriptions: ActiveCategorySubscription[];
};

export type RazorpayOrder = {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  planName: string;
  planPrice: number;
  originalPrice?: number;
  discountAmount?: number;
  finalPrice?: number;
  couponCode?: string | null;
  couponApplied?: boolean;
  category?: CategorySlug;
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
  category: null,
  status: 'none',
  price: PRO_PRICE,
  currency: 'INR',
  durationDays: 30,
  startDate: null,
  expiryDate: null,
  remainingDays: 0,
  transactionId: null,
  razorpayConfigured: false,
  plans: [],
  access: {},
  activeSubscriptions: [],
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

export function formatInr(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `₹${n}`;
}

export function formatPlanPrice(plan: Pick<SubscriptionPlan, 'price' | 'durationDays'>): string {
  const days = plan.durationDays || 30;
  const period = days === 30 ? 'month' : `${days} days`;
  return `${formatInr(plan.price)}/${period}`;
}

export function priceLabelForCategory(
  category: string,
  plans: SubscriptionPlan[] | undefined,
  fallback = PRO_PRICE_LABEL
): string {
  const plan = plans?.find((p) => p.category === category);
  return plan ? formatPlanPrice(plan) : fallback;
}

/** Fetch the signed-in user's current subscription status from the server. */
export async function fetchSubscription(): Promise<SubscriptionSummary> {
  const sessionOk = await ensureValidSession();
  if (!sessionOk) return FREE_SUBSCRIPTION;

  const res = await apiFetch<{ data: SubscriptionSummary }>('/api/subscription/me');
  return {
    ...FREE_SUBSCRIPTION,
    ...(res.data || {}),
    plans: res.data?.plans || [],
    access: res.data?.access || {},
    activeSubscriptions: res.data?.activeSubscriptions || [],
  };
}

function checkoutBody(category: CategorySlug, couponCode?: string | null) {
  const code = String(couponCode || '').trim().toUpperCase();
  return JSON.stringify(code ? { category, couponCode: code } : { category });
}

export async function previewCheckout(
  category: CategorySlug,
  couponCode?: string | null
): Promise<CheckoutQuote> {
  const res = await apiFetch<{ data: CheckoutQuote }>('/api/subscription/preview', {
    method: 'POST',
    body: checkoutBody(category, couponCode),
  });
  if (!res.data) {
    throw new Error('Could not load checkout price. Please try again.');
  }
  return res.data;
}

/** Create a Razorpay order for a category plan (coupon re-validated on the server). */
export async function createRazorpayOrder(
  category: CategorySlug,
  couponCode?: string | null
): Promise<RazorpayOrder> {
  const res = await apiFetch<{ data: RazorpayOrder }>('/api/subscription/create-order', {
    method: 'POST',
    body: checkoutBody(category, couponCode),
  });
  if (!res.data?.orderId || !res.data?.keyId) {
    throw new Error('Could not create Razorpay order. Please try again.');
  }
  return res.data;
}

/** Verify Razorpay payment on the server and activate the category subscription. */
export async function verifyRazorpayPayment(payload: RazorpaySuccess): Promise<SubscriptionSummary> {
  const res = await apiFetch<{ data: SubscriptionSummary }>('/api/subscription/verify-payment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    ...FREE_SUBSCRIPTION,
    ...(res.data || {}),
    plans: res.data?.plans || [],
    access: res.data?.access || {},
    activeSubscriptions: res.data?.activeSubscriptions || [],
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyRazorpayPaymentWithRetry(payload: RazorpaySuccess): Promise<SubscriptionSummary> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await verifyRazorpayPayment(payload);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Activation failed');
      if (/another account|invalid razorpay signature|invalid signature/i.test(lastError.message)) {
        break;
      }
      await wait(700 * (attempt + 1));
    }
  }
  throw new Error(
    `Payment received but activation is delayed. If access is not unlocked shortly, contact support with payment ID ${payload.razorpay_payment_id}. ${lastError?.message || ''}`.trim()
  );
}

/**
 * Category checkout: create order → open Razorpay → verify payment → activate.
 * Coupon is validated on the server before the order is created.
 */
export async function purchaseWithRazorpay(
  category: CategorySlug,
  couponCode?: string | null
): Promise<SubscriptionSummary> {
  const order = await createRazorpayOrder(category, couponCode);
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
    description: order.description || `${order.planName} Subscription`,
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

  return verifyRazorpayPaymentWithRetry({
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
