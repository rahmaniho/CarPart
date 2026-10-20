import {
  DELIVERY_STATUS_META,
  ORDER_STATUS_META,
  QUALITY_META,
  ROLE_LABELS_FA,
  formatJalali,
  formatToman,
  normalizeIranMobile,
  toLatinDigits,
  toPersianDigits,
  type CurrentUserDto,
  type DeliveryStatus,
  type OrderStatus,
  type Page,
  type QualityGrade,
} from '@carpart/contract';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DEFAULT_ANDROID_EMULATOR_ORIGIN,
  DEFAULT_CLOUD_SERVER_ORIGIN,
  api,
  getMobileApiOrigin,
  makeMobileIdempotencyKey,
  setMobileAccessToken,
  setMobileApiOrigin,
} from './src/api';

type MobileTab = 'catalog' | 'cart' | 'rfq' | 'panel' | 'account';

interface MobileOffer {
  sellerProductId: string;
  partId: string;
  partNameFa: string;
  sellerId: string;
  sellerName: string;
  price: number;
  stock: number;
  quality: QualityGrade;
  rank: { total: number };
}

interface MobileOrderRow {
  id: string;
  code: string;
  status: OrderStatus;
  payableTotal: number;
  createdAt: string;
}

interface MobileTracking {
  code: string;
  status: DeliveryStatus;
  deliveryOtp: string | null;
  pickupCode: string | null;
  distanceKm: number | null;
}

interface MobileMission {
  id: string;
  code: string;
  status: DeliveryStatus;
  courierShare: number;
  pickupPoint: { title?: string; addressText: string };
  dropoffPoint: { receiverName?: string; addressText: string };
}

interface CartRow {
  sellerProductId: string;
  sellerId: string;
  sellerName: string;
  partNameFa: string;
  unitPrice: number;
  quantity: number;
}

const DEMO_USERS = [
  { label: 'مکانیک (تعمیرگاه)', mobile: '09121110001' },
  { label: 'فروشنده قطعه', mobile: '09122220001' },
  { label: 'پیک ناوگان', mobile: '09123330001' },
  { label: 'اپراتور پشتیبانی', mobile: '09120000001' },
  { label: 'مدیر کل پلتفرم', mobile: '09120000000' },
];

export default function App() {
  const [tab, setTab] = useState<MobileTab>('catalog');
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // جست‌وجوی کاتالوگ
  const [searchQ, setSearchQ] = useState('');
  const [offers, setOffers] = useState<MobileOffer[]>([]);

  // سبد خرید تک‌فروشنده‌ای
  const [cart, setCart] = useState<CartRow[]>([]);
  const [couponCode, setCouponCode] = useState('WELCOME10');

  // استعلام قیمت RFQ
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqQty, setRfqQty] = useState('1');

  // داده‌های پنل نقش‌محور
  const [orders, setOrders] = useState<MobileOrderRow[]>([]);
  const [trackingMap, setTrackingMap] = useState<Record<string, MobileTracking>>({});
  const [missions, setMissions] = useState<MobileMission[]>([]);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [adminSummary, setAdminSummary] = useState<{ gmv: number; platformRevenue: number; totalOrders: number } | null>(
    null,
  );

  // حساب و سرور
  const [mobileInput, setMobileInput] = useState('09121110001');
  const [serverOrigin, setServerOrigin] = useState(getMobileApiOrigin());

  const loadCatalog = async (q = searchQ) => {
    setLoading(true);
    try {
      const page = await api.get<Page<MobileOffer>>('catalog/search', {
        q: q.trim() || undefined,
        inStockOnly: 'true',
        pageSize: 15,
      });
      setOffers(page.items);
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'خطا در دریافت کاتالوگ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog('');
  }, []);

  const refreshRolePanel = async (activeUser: CurrentUserDto | null = user) => {
    if (!activeUser) return;
    setLoading(true);
    try {
      if (activeUser.roles.includes('admin') || activeUser.roles.includes('operator')) {
        const dash = await api.get<{
          orders: { total: number };
          money: { gmv: number; platformRevenue: number };
        }>('admin/dashboard');
        setAdminSummary({
          gmv: dash.money.gmv,
          platformRevenue: dash.money.platformRevenue,
          totalOrders: dash.orders.total,
        });
      } else if (activeUser.roles.includes('seller')) {
        const res = await api.get<Page<MobileOrderRow>>('seller/orders', { pageSize: 15 });
        setOrders(res.items);
      } else if (activeUser.roles.includes('courier')) {
        const offered = await api.get<Page<MobileMission>>('courier/deliveries', { status: 'offers' });
        const active = await api.get<Page<MobileMission>>('courier/deliveries', { status: 'active' });
        setMissions([...active.items, ...offered.items]);
      } else {
        const res = await api.get<Page<MobileOrderRow>>('orders', { pageSize: 15 });
        setOrders(res.items);
      }
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'خطا در بارگذاری پنل');
    } finally {
      setLoading(false);
    }
  };

  const quickDevLogin = async (rawMobile: string) => {
    const mobile = normalizeIranMobile(rawMobile);
    if (!mobile) {
      setBannerMsg('شماره موبایل معتبر نیست.');
      return;
    }
    setLoading(true);
    try {
      const otpReq = await api.post<{ devCode?: string }>('auth/otp/request', {
        mobile,
        purpose: 'login',
      });
      if (!otpReq.devCode) {
        setBannerMsg('کد توسعه روی این سرور غیرفعال است؛ از رمز عبور استفاده کنید.');
        return;
      }
      const session = await api.post<{ user: CurrentUserDto; accessToken: string }>('auth/otp/verify', {
        mobile,
        code: otpReq.devCode,
        purpose: 'login',
      });
      setMobileAccessToken(session.accessToken);
      setUser(session.user);
      setBannerMsg(`خوش آمدید، ${session.user.fullName}`);
      setTab('panel');
      await refreshRolePanel(session.user);
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (offer: MobileOffer) => {
    if (cart.length > 0 && cart[0].sellerId !== offer.sellerId) {
      setBannerMsg(`سبد فعلی متعلق به «${cart[0].sellerName}» است؛ هر سفارش تک‌فروشنده‌ای ثبت می‌شود.`);
      return;
    }
    setCart((prev) => {
      const found = prev.find((i) => i.sellerProductId === offer.sellerProductId);
      if (found) {
        return prev.map((i) =>
          i.sellerProductId === offer.sellerProductId ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          sellerProductId: offer.sellerProductId,
          sellerId: offer.sellerId,
          sellerName: offer.sellerName,
          partNameFa: offer.partNameFa,
          unitPrice: offer.price,
          quantity: 1,
        },
      ];
    });
    setBannerMsg(`«${offer.partNameFa}» به سبد اضافه شد`);
  };

  const submitCartOrder = async () => {
    if (!user) {
      setTab('account');
      setBannerMsg('ابتدا با حساب مکانیک وارد شوید.');
      return;
    }
    setLoading(true);
    try {
      const created = await api.post<MobileOrderRow>(
        'orders',
        {
          items: cart.map((c) => ({ sellerProductId: c.sellerProductId, quantity: c.quantity })),
          couponCode: couponCode.trim() || undefined,
          urgency: 'normal',
        },
        { idempotencyKey: makeMobileIdempotencyKey('order') },
      );
      setCart([]);
      setBannerMsg(`سفارش ${created.code} ثبت و موجودی رزرو شد.`);
      setTab('panel');
      await refreshRolePanel();
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'خطا در ثبت سفارش');
    } finally {
      setLoading(false);
    }
  };

  const payOrderSandbox = async (orderId: string) => {
    setLoading(true);
    try {
      await api.post('payments', { orderId }, { idempotencyKey: makeMobileIdempotencyKey('pay') });
      await api.post('payments/sandbox/confirm', { orderId, decision: 'paid' });
      setBannerMsg('پرداخت آزمایشی تأیید شد.');
      await refreshRolePanel();
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'خطا در پرداخت');
    } finally {
      setLoading(false);
    }
  };

  const inspectOrderCodes = async (orderId: string, asSeller: boolean) => {
    try {
      const data = await api.get<MobileTracking>(asSeller ? `seller/deliveries/${orderId}` : `orders/${orderId}/tracking`);
      setTrackingMap((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'اطلاعات ارسال هنوز آماده نیست');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#115E59" barStyle="light-content" />

      {/* سرصفحه اپلیکیشن بومی اندروید */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>قطعه‌رسان • نسخه همراه اندروید</Text>
          <Text style={styles.headerSub}>
            {user ? `${user.fullName} (${ROLE_LABELS_FA[user.roles[0]]})` : 'بازار تأمین شفاف و ارسال فوری قطعه'}
          </Text>
        </View>
        {loading && <ActivityIndicator color="#FBBF24" />}
      </View>

      {bannerMsg ? (
        <TouchableOpacity onPress={() => setBannerMsg(null)} style={styles.toastBar}>
          <Text style={styles.toastText}>{bannerMsg} (بستن ×)</Text>
        </TouchableOpacity>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {/* ۱. کاتالوگ قطعات */}
        {tab === 'catalog' && (
          <View style={styles.section}>
            <View style={styles.searchRow}>
              <TextInput
                value={searchQ}
                onChangeText={setSearchQ}
                placeholder="جست‌وجوی نام قطعه یا کد فنی..."
                style={[styles.input, { flex: 1 }]}
                textAlign="right"
              />
              <TouchableOpacity onPress={() => void loadCatalog(searchQ)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>بیاب</Text>
              </TouchableOpacity>
            </View>

            {offers.map((offer) => (
              <View key={offer.sellerProductId} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.badgeTeal}>{QUALITY_META[offer.quality].fa}</Text>
                  <Text style={styles.mutedText}>امتیاز شفاف: {toPersianDigits(Math.round(offer.rank.total))}/۱۰۰</Text>
                </View>
                <Text style={styles.cardTitle}>{offer.partNameFa}</Text>
                <Text style={styles.mutedText}>
                  فروشگاه: {offer.sellerName} • موجودی: {toPersianDigits(offer.stock)}
                </Text>
                <View style={[styles.rowBetween, { marginTop: 10 }]}>
                  <TouchableOpacity onPress={() => addToCart(offer)} style={styles.accentBtn}>
                    <Text style={styles.primaryBtnText}>+ افزودن به سبد</Text>
                  </TouchableOpacity>
                  <Text style={styles.priceText}>{formatToman(offer.price)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ۲. سبد خرید */}
        {tab === 'cart' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>سبد خرید تک‌فروشنده‌ای</Text>
            {cart.length === 0 ? (
              <Text style={styles.mutedText}>سبد خرید شما خالی است.</Text>
            ) : (
              <>
                {cart.map((item) => (
                  <View key={item.sellerProductId} style={styles.card}>
                    <Text style={styles.cardTitle}>{item.partNameFa}</Text>
                    <Text style={styles.mutedText}>
                      تعداد: {toPersianDigits(item.quantity)} × {formatToman(item.unitPrice)}
                    </Text>
                  </View>
                ))}
                <TextInput
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholder="کد تخفیف (مثلاً WELCOME10)"
                  style={styles.input}
                />
                <TouchableOpacity onPress={() => void submitCartOrder()} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>ثبت نهایی سفارش با کلید یکتاسازی</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ۳. استعلام قیمت (RFQ) */}
        {tab === 'rfq' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ثبت استعلام رقابتی قطعه (RFQ)</Text>
            <TextInput
              value={rfqTitle}
              onChangeText={setRfqTitle}
              placeholder="نام قطعه موردنیاز (مثلاً واتر پمپ پراید)"
              style={styles.input}
              textAlign="right"
            />
            <TextInput
              value={rfqQty}
              onChangeText={setRfqQty}
              keyboardType="numeric"
              placeholder="تعداد"
              style={styles.input}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!user) {
                  setTab('account');
                  setBannerMsg('ابتدا با حساب مکانیک وارد شوید.');
                  return;
                }
                try {
                  const res = await api.post<{ code: string }>('requests', {
                    partNameFa: rfqTitle,
                    titleFa: rfqTitle,
                    quantity: Number(toLatinDigits(rfqQty)) || 1,
                    urgency: 'urgent',
                  });
                  setRfqTitle('');
                  setBannerMsg(`استعلام ${res.code} برای فروشندگان ارسال شد.`);
                } catch (err) {
                  setBannerMsg(err instanceof Error ? err.message : 'خطا در ثبت استعلام');
                }
              }}
              style={styles.accentBtn}
            >
              <Text style={styles.primaryBtnText}>ارسال استعلام به فروشندگان شهر</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ۴. پنل نقش‌محور */}
        {tab === 'panel' && (
          <View style={styles.section}>
            {!user ? (
              <Text style={styles.mutedText}>برای مشاهده پنل تخصصی از زبانه «حساب» وارد شوید.</Text>
            ) : user.roles.includes('admin') || user.roles.includes('operator') ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>شاخص‌های زنده مدیریت پلتفرم</Text>
                {adminSummary && (
                  <>
                    <Text style={styles.priceText}>گردش ناخالص (GMV): {formatToman(adminSummary.gmv)}</Text>
                    <Text style={styles.mutedText}>
                      درآمد خالص کارمزد پلتفرم: {formatToman(adminSummary.platformRevenue)}
                    </Text>
                    <Text style={styles.mutedText}>
                      کل سفارش‌ها: {toPersianDigits(adminSummary.totalOrders)}
                    </Text>
                  </>
                )}
              </View>
            ) : user.roles.includes('courier') ? (
              <>
                <View style={styles.rowBetween}>
                  <TouchableOpacity
                    onPress={async () => {
                      await api.post('couriers/me/availability', { availability: 'online' });
                      setBannerMsg('وضعیت شما آنلاین شد.');
                      await refreshRolePanel();
                    }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>اعلام آمادگی آنلاین</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await api.post('couriers/me/location', { lat: 35.732, lng: 51.398 });
                      setBannerMsg('موقعیت مکانی ثبت شد.');
                    }}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>ثبت موقعیت GPS</Text>
                  </TouchableOpacity>
                </View>

                {missions.map((m) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {m.code} — {DELIVERY_STATUS_META[m.status].fa}
                    </Text>
                    <Text style={styles.mutedText}>سهم پیک: {formatToman(m.courierShare)}</Text>
                    {m.status === 'OFFERED' && (
                      <TouchableOpacity
                        onPress={async () => {
                          await api.post(`courier/deliveries/${m.id}/accept`);
                          await refreshRolePanel();
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>پذیرش مأموریت</Text>
                      </TouchableOpacity>
                    )}
                    {m.status === 'ACCEPTED' && (
                      <View style={styles.searchRow}>
                        <TextInput
                          value={codeInputs[m.id] ?? ''}
                          onChangeText={(v) => setCodeInputs({ ...codeInputs, [m.id]: v })}
                          placeholder="کد ۵ رقمی فروشنده"
                          style={[styles.input, { flex: 1 }]}
                        />
                        <TouchableOpacity
                          onPress={async () => {
                            await api.post(`courier/deliveries/${m.id}/pickup`, {
                              pickupCode: toLatinDigits(codeInputs[m.id] ?? '').trim(),
                            });
                            await refreshRolePanel();
                          }}
                          style={styles.primaryBtn}
                        >
                          <Text style={styles.primaryBtnText}>بارگیری</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {m.status === 'PICKED_UP' && (
                      <TouchableOpacity
                        onPress={async () => {
                          await api.post(`courier/deliveries/${m.id}/transit`);
                          await refreshRolePanel();
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>شروع حرکت به مقصد</Text>
                      </TouchableOpacity>
                    )}
                    {m.status === 'IN_TRANSIT' && (
                      <View style={styles.searchRow}>
                        <TextInput
                          value={codeInputs[m.id] ?? ''}
                          onChangeText={(v) => setCodeInputs({ ...codeInputs, [m.id]: v })}
                          placeholder="کد OTP تحویل گیرنده"
                          style={[styles.input, { flex: 1 }]}
                        />
                        <TouchableOpacity
                          onPress={async () => {
                            await api.post(`courier/deliveries/${m.id}/deliver`, {
                              otp: toLatinDigits(codeInputs[m.id] ?? '').trim(),
                            });
                            await refreshRolePanel();
                          }}
                          style={styles.accentBtn}
                        >
                          <Text style={styles.primaryBtnText}>ثبت تحویل</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            ) : (
              orders.map((ord) => {
                const isSeller = user.roles.includes('seller');
                const track = trackingMap[ord.id];
                return (
                  <View key={ord.id} style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.badgeTeal}>{ORDER_STATUS_META[ord.status].fa}</Text>
                      <Text style={styles.cardTitle}>{ord.code}</Text>
                    </View>
                    <Text style={styles.mutedText}>
                      {formatJalali(ord.createdAt)} • مبلغ: {formatToman(ord.payableTotal)}
                    </Text>

                    {!isSeller && ord.status === 'WAITING_FOR_PAYMENT' && (
                      <TouchableOpacity onPress={() => void payOrderSandbox(ord.id)} style={styles.accentBtn}>
                        <Text style={styles.primaryBtnText}>پرداخت آزمایشی (Sandbox)</Text>
                      </TouchableOpacity>
                    )}

                    {isSeller && ord.status === 'PAID' && (
                      <TouchableOpacity
                        onPress={async () => {
                          await api.post(`seller/orders/${ord.id}/transition`, { to: 'SELLER_CONFIRMED' });
                          await refreshRolePanel();
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>تأیید سفارش</Text>
                      </TouchableOpacity>
                    )}

                    {isSeller && ord.status === 'SELLER_CONFIRMED' && (
                      <TouchableOpacity
                        onPress={async () => {
                          await api.post(`seller/orders/${ord.id}/transition`, { to: 'PREPARING' });
                          await refreshRolePanel();
                        }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryBtnText}>شروع بسته‌بندی</Text>
                      </TouchableOpacity>
                    )}

                    {isSeller && ord.status === 'PREPARING' && (
                      <TouchableOpacity
                        onPress={async () => {
                          await api.post(`seller/orders/${ord.id}/transition`, { to: 'READY_FOR_PICKUP' });
                          await refreshRolePanel();
                        }}
                        style={styles.accentBtn}
                      >
                        <Text style={styles.primaryBtnText}>آماده تحویل به پیک</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => void inspectOrderCodes(ord.id, isSeller)}
                      style={styles.secondaryBtn}
                    >
                      <Text style={styles.secondaryBtnText}>مشاهده کد ردیابی / تحویل</Text>
                    </TouchableOpacity>

                    {track?.deliveryOtp ? (
                      <Text style={styles.otpHighlight}>کد OTP تحویل خریدار: {track.deliveryOtp}</Text>
                    ) : null}
                    {track?.pickupCode ? (
                      <Text style={styles.otpHighlight}>کد ۵ رقمی تحویل به پیک: {track.pickupCode}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ۵. حساب کاربری و تنظیم سرور */}
        {tab === 'account' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ورود یک‌کلیکی نقش‌های نمونه</Text>
            {DEMO_USERS.map((d) => (
              <TouchableOpacity
                key={d.mobile}
                onPress={() => void quickDevLogin(d.mobile)}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  {d.label} — {d.mobile}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>ورود با شماره دلخواه (OTP)</Text>
            <View style={styles.searchRow}>
              <TextInput value={mobileInput} onChangeText={setMobileInput} style={[styles.input, { flex: 1 }]} />
              <TouchableOpacity onPress={() => void quickDevLogin(mobileInput)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>ورود</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>آدرس سرور API اندروید</Text>
            <TextInput value={serverOrigin} onChangeText={setServerOrigin} style={styles.input} />
            <View style={styles.rowBetween}>
              <TouchableOpacity
                onPress={() => {
                  setServerOrigin(DEFAULT_CLOUD_SERVER_ORIGIN);
                  setMobileApiOrigin(DEFAULT_CLOUD_SERVER_ORIGIN);
                  setBannerMsg('سرور ابری فعال انتخاب شد.');
                }}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>سرور ابری</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setServerOrigin(DEFAULT_ANDROID_EMULATOR_ORIGIN);
                  setMobileApiOrigin(DEFAULT_ANDROID_EMULATOR_ORIGIN);
                  setBannerMsg('شبیه‌ساز 10.0.2.2 انتخاب شد.');
                }}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>شبیه‌ساز AVD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMobileApiOrigin(serverOrigin);
                  setBannerMsg('آدرس جدید سرور ذخیره شد.');
                  void loadCatalog('');
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>ذخیره</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* نوار تب پایین اندروید */}
      <View style={styles.bottomTabs}>
        {(
          [
            { key: 'catalog', label: 'قطعات' },
            { key: 'cart', label: `سبد (${toPersianDigits(cart.length)})` },
            { key: 'rfq', label: 'استعلام' },
            { key: 'panel', label: 'پنل من' },
            { key: 'account', label: 'حساب/سرور' },
          ] as const
        ).map((item) => (
          <TouchableOpacity key={item.key} onPress={() => setTab(item.key)} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#115E59',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  headerSub: { color: '#CCFBF1', fontSize: 12, marginTop: 2, textAlign: 'right' },
  toastBar: { backgroundColor: '#FEF3C7', padding: 10, borderBottomWidth: 1, borderColor: '#FCD34D' },
  toastText: { color: '#78350F', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  content: { padding: 14, paddingBottom: 32 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  searchRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  mutedText: { fontSize: 12, color: '#64748B', textAlign: 'right' },
  priceText: { fontSize: 15, fontWeight: '800', color: '#0F766E' },
  badgeTeal: {
    backgroundColor: '#CCFBF1',
    color: '#115E59',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rowBetween: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  primaryBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  accentBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secondaryBtnText: { color: '#1E293B', fontSize: 12, fontWeight: '700' },
  otpHighlight: {
    marginTop: 6,
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    padding: 8,
    borderRadius: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
  bottomTabs: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#0F766E', fontWeight: '900' },
});
