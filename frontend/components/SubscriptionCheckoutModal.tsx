import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CategorySlug,
  CheckoutQuote,
  SubscriptionSummary,
  formatInr,
  previewCheckout,
  purchaseWithRazorpay,
} from '@/utils/subscriptionApi';

type Props = {
  visible: boolean;
  category: CategorySlug | null;
  onClose: () => void;
  onPurchased: (summary: SubscriptionSummary) => void;
};

export default function SubscriptionCheckoutModal({ visible, category, onClose, onPurchased }: Props) {
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(async (code?: string | null) => {
    if (!category) return;
    setError(null);
    setLoading(true);
    try {
      const next = await previewCheckout(category, code);
      setQuote(next);
      setAppliedCode(next.couponApplied ? next.couponCode : null);
    } catch (e) {
      setQuote(null);
      setAppliedCode(null);
      setError(e instanceof Error ? e.message : 'Could not load price.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (!visible || !category) {
      setQuote(null);
      setCouponInput('');
      setAppliedCode(null);
      setError(null);
      setPaying(false);
      return;
    }
    void loadQuote(null);
  }, [visible, category, loadQuote]);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setError('Enter a coupon code.');
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const next = await previewCheckout(category as CategorySlug, code);
      setQuote(next);
      setAppliedCode(next.couponApplied ? next.couponCode : null);
      setCouponInput(next.couponCode || code);
    } catch (e) {
      setAppliedCode(null);
      const message = e instanceof Error ? e.message : 'This coupon cannot be used. You can still pay the full price.';
      try {
        const next = await previewCheckout(category as CategorySlug, null);
        setQuote(next);
      } catch {
        /* keep last quote */
      }
      setError(message);
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = async () => {
    setCouponInput('');
    setAppliedCode(null);
    await loadQuote(null);
  };

  const pay = async () => {
    if (!category || !quote) return;
    setPaying(true);
    setError(null);
    try {
      let code: string | null = appliedCode;
      const typed = couponInput.trim().toUpperCase();

      // Coupon is optional. Only attach a code that already applied, or a typed
      // code that validates. An invalid typed code must not block payment.
      if (!code && typed) {
        try {
          const next = await previewCheckout(category, typed);
          if (next.couponApplied && next.couponCode) {
            setQuote(next);
            code = next.couponCode;
            setAppliedCode(code);
            setCouponInput(code);
          }
        } catch {
          code = null;
        }
      }

      const summary = await purchaseWithRazorpay(category, code);
      onClose();
      onPurchased(summary);
      Alert.alert(
        'Subscription activated 🎉',
        `${quote.title} is unlocked. Enjoy the courses!`
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not complete the payment. Please try again.';
      if (/payment cancelled/i.test(message)) {
        return;
      }
      setError(message);
    } finally {
      setPaying(false);
    }
  };

  const hasCouponText = couponInput.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => { if (!paying) onClose(); }}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dismiss} onPress={paying ? undefined : onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>{quote?.title || 'Subscription'} checkout</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} disabled={paying}>
              <Feather name="x" size={22} color="#1a202c" />
            </TouchableOpacity>
          </View>

          {loading && !quote ? (
            <ActivityIndicator color="#e60000" style={{ marginVertical: 24 }} />
          ) : quote ? (
            <>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  value={couponInput}
                  onChangeText={(t) => {
                    setCouponInput(t.toUpperCase());
                    if (error) setError(null);
                  }}
                  placeholder="Coupon code"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!paying}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.applyBtn, hasCouponText ? styles.applyBtnActive : styles.applyBtnIdle]}
                  onPress={() => void applyCoupon()}
                  disabled={applying || paying || !hasCouponText}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.applyBtnText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {appliedCode ? (
                <TouchableOpacity onPress={() => void removeCoupon()}>
                  <Text style={styles.removeCoupon}>Remove coupon {appliedCode}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.breakdown}>
                <View style={styles.breakRow}>
                  <Text style={styles.breakLabel}>Original price</Text>
                  <Text style={styles.breakValue}>{formatInr(quote.originalPrice)}</Text>
                </View>
                {quote.discountAmount > 0 ? (
                  <View style={styles.breakRow}>
                    <Text style={styles.breakLabel}>
                      Discount{appliedCode ? ` (${appliedCode})` : ''}
                    </Text>
                    <Text style={[styles.breakValue, styles.discount]}>
                      −{formatInr(quote.discountAmount)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.breakRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Amount to pay</Text>
                  <Text style={styles.totalValue}>{formatInr(quote.finalPrice)}</Text>
                </View>
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.payBtn, (paying || !quote) && { opacity: 0.7 }]}
            onPress={() => void pay()}
            disabled={paying || !quote}
          >
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payBtnText}>
                Pay {quote ? formatInr(quote.finalPrice) : ''}
              </Text>
            )}
          </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a202c',
  },
  couponRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#1a202c',
  },
  applyBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    minWidth: 78,
    alignItems: 'center',
  },
  applyBtnIdle: {
    backgroundColor: '#cbd5e1',
  },
  applyBtnActive: {
    backgroundColor: '#e60000',
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  removeCoupon: {
    color: '#e60000',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
  },
  breakdown: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    gap: 8,
  },
  breakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakLabel: {
    color: '#64748b',
    fontWeight: '600',
  },
  breakValue: {
    color: '#1a202c',
    fontWeight: '800',
  },
  discount: {
    color: '#00b894',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '800',
    color: '#1a202c',
  },
  totalValue: {
    fontWeight: '900',
    color: '#e60000',
    fontSize: 18,
  },
  error: {
    color: '#e60000',
    marginTop: 10,
    fontWeight: '600',
    fontSize: 13,
  },
  payBtn: {
    backgroundColor: '#e60000',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  payBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
