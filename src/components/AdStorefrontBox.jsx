import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Utensils,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle2,
  Package,
  Truck,
  CreditCard,
  Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdStorefrontBox({ adId }) {
  const [sellerApiUrl, setSellerApiUrl] = useState('');
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // { productId: qty }
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' | 'pickup'
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery'); // 'stripe' | 'cash_on_delivery'
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    if (!adId) return;
    let cancelled = false;

    const loadStorefront = async () => {
      let apiUrl = '';
      try {
        const res = await fetch(`/api/public?action=get_ad_seller_api&ad_id=${encodeURIComponent(adId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.seller_api_url) apiUrl = json.seller_api_url;
        }
      } catch {}

      if (!apiUrl) {
        try {
          const { data } = await supabase
            .from('swedpersiska_settings')
            .select('value')
            .eq('key', 'ad_seller_links')
            .maybeSingle();
          if (data?.value && data.value[adId]) {
            apiUrl = data.value[adId];
          }
        } catch {}
      }

      if (!apiUrl || cancelled) return;
      setSellerApiUrl(apiUrl);

      try {
        const sfRes = await fetch(apiUrl);
        if (sfRes.ok) {
          const sfJson = await sfRes.json();
          if (sfJson?.ok && !cancelled) {
            setStore(sfJson.store || null);
            setProducts(Array.isArray(sfJson.products) ? sfJson.products : []);
            if (sfJson.store?.stripe?.enabled) {
              setPaymentMethod('stripe');
            }
          }
        }
      } catch {}
    };

    loadStorefront();
    return () => {
      cancelled = true;
    };
  }, [adId]);

  if (!store || products.length === 0) return null;

  const updateCart = (productId, delta) => {
    setCart((prev) => {
      const nextQty = Math.max(0, (prev[productId] || 0) + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: nextQty };
    });
  };

  const cartItems = Object.entries(cart)
    .map(([pid, qty]) => {
      const prod = products.find((p) => p.id === pid);
      return prod ? { productId: pid, title: prod.title, price: Number(prod.price) || 0, qty } : null;
    })
    .filter(Boolean);

  const totalItems = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const baseShipping = Number(store.shippingFee) || 0;
  const freeOver = Number(store.freeShippingOver) || 0;
  const shippingFee =
    deliveryType === 'pickup' || (freeOver > 0 && subtotal >= freeOver) ? 0 : baseShipping;
  const totalAmount = subtotal + shippingFee;
  const stripeEnabled = Boolean(store.stripe?.enabled);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setOrderError('');
    if (!customerName.trim() || !customerPhone.trim() || cartItems.length === 0) {
      setOrderError('لطفاً نام و شماره تماس را وارد کنید.');
      return;
    }
    if (deliveryType === 'delivery' && !customerAddress.trim()) {
      setOrderError('برای ارسال با پیک، وارد کردن آدرس الزامی است.');
      return;
    }
    if (paymentMethod === 'stripe' && (!cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim())) {
      setOrderError('لطفاً اطلاعات کارت بانکی را برای پرداخت Stripe وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const parsed = new URL(sellerApiUrl);
      const apiKey = parsed.searchParams.get('key') || '';
      const ordersEndpoint = `${parsed.origin}/api/orders`;

      const res = await fetch(ordersEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: deliveryType === 'pickup' ? 'تحویل حضوری' : customerAddress.trim(),
          deliveryType,
          paymentMethod,
          paymentPaid: paymentMethod === 'stripe',
          items: cartItems,
          source: `ad_${adId}`,
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setOrderError(json?.error || 'خطا در ثبت سفارش');
        return;
      }
      setOrderSuccess(json.order);
      setCart({});
      setCheckoutOpen(false);
    } catch {
      setOrderError('خطا در ارسال سفارش به پنل فروش');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-6 border-t border-[#E5E5EA] space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#0066CC] text-white flex items-center justify-center shrink-0">
            {store.type === 'restaurant' ? <Utensils size={16} /> : <ShoppingBag size={16} />}
          </div>
          <div>
            <h3 className="text-sm font-black text-[#1D1D1F]">{store.name}</h3>
            <p className="text-[11px] text-[#6E6E73]">
              {store.type === 'restaurant' ? 'منوی آنلاین و سفارش مستقیم غذا' : 'فروشگاه آنلاین متصل به آگهی'}
              {baseShipping > 0 ? ` • ارسال: ${baseShipping} ${store.currency}` : ' • ارسال رایگان'}
            </p>
          </div>
        </div>

        {totalItems > 0 && (
          <button
            type="button"
            onClick={() => setCheckoutOpen((v) => !v)}
            className="h-9 px-4 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <ShoppingCart size={14} />
            <span>سبد خرید ({totalItems}) • {totalAmount.toLocaleString('en-US')} {store.currency}</span>
          </button>
        )}
      </div>

      {orderSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>
            سفارش شما با کد پیگیری <strong className="font-mono">{orderSuccess.id}</strong> مستقیماً در پنل فروش {store.name} ثبت شد!
          </span>
        </div>
      )}

      {/* Products / Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((p) => {
          const qty = cart[p.id] || 0;
          return (
            <div
              key={p.id}
              className="p-3 rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] overflow-hidden shrink-0 flex items-center justify-center">
                  {p.image ? (
                    <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={18} className="text-[#86868B]" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#0066CC] block">{p.category}</span>
                  <p className="text-xs font-bold text-[#1D1D1F] truncate">{p.title}</p>
                  <p className="text-xs font-black text-emerald-700 mt-0.5 tabular-nums" dir="ltr">
                    {Number(p.price || 0).toLocaleString('en-US')} {store.currency}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {qty > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateCart(p.id, -1)}
                      className="h-7 w-7 rounded-full bg-[#ECECEF] hover:bg-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-black w-5 text-center tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateCart(p.id, 1)}
                      className="h-7 w-7 rounded-full bg-[#0066CC] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateCart(p.id, 1)}
                    className="h-8 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#0066CC] hover:text-white text-[#1D1D1F] text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>افزودن</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline Checkout Form */}
      {checkoutOpen && cartItems.length > 0 && (
        <form
          onSubmit={handleSubmitOrder}
          className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-3.5"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-black text-[#1D1D1F]">تکمیل سفارش</h4>
            <div className="text-xs text-[#515154] tabular-nums">
              جمع کالا: <strong>{subtotal}</strong> + ارسال: <strong>{shippingFee === 0 ? 'رایگان' : shippingFee}</strong> ={' '}
              <strong className="text-emerald-700" dir="ltr">{totalAmount.toLocaleString('en-US')} {store.currency}</strong>
            </div>
          </div>

          {orderError && <p className="text-xs font-bold text-rose-600">{orderError}</p>}

          {/* Delivery Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                deliveryType === 'delivery'
                  ? 'bg-white border-[#0066CC] text-[#0066CC]'
                  : 'bg-white/60 border-[#d2d2d7] text-[#6e6e73]'
              }`}
            >
              <Truck size={14} />
              <span>ارسال با پیک ({baseShipping === 0 ? 'رایگان' : `${baseShipping} ${store.currency}`})</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                deliveryType === 'pickup'
                  ? 'bg-white border-[#0066CC] text-[#0066CC]'
                  : 'bg-white/60 border-[#d2d2d7] text-[#6e6e73]'
              }`}
            >
              <ShoppingBag size={14} />
              <span>تحویل حضوری (رایگان)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="نام و نام خانوادگی *"
              className="h-10 rounded-xl bg-white border border-[#d2d2d7] px-3 text-xs"
            />
            <input
              type="tel"
              required
              dir="ltr"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="شماره تماس / واتساپ *"
              className="h-10 rounded-xl bg-white border border-[#d2d2d7] px-3 text-xs font-mono text-left"
            />
          </div>

          {deliveryType === 'delivery' && (
            <input
              type="text"
              required
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="آدرس دقیق تحویل *"
              className="w-full h-10 rounded-xl bg-white border border-[#d2d2d7] px-3 text-xs"
            />
          )}

          {/* Payment Method */}
          <div className="space-y-2 pt-1">
            <span className="block text-[11px] font-bold text-[#6E6E73]">روش پرداخت:</span>
            <div className={`grid gap-2 ${stripeEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {stripeEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('stripe')}
                  className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'stripe'
                      ? 'bg-white border-indigo-600 text-indigo-700'
                      : 'bg-white/60 border-[#d2d2d7] text-[#6e6e73]'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>پرداخت آنلاین (Stripe)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPaymentMethod('cash_on_delivery')}
                className={`h-9 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'cash_on_delivery'
                    ? 'bg-white border-[#0066CC] text-[#0066CC]'
                    : 'bg-white/60 border-[#d2d2d7] text-[#6e6e73]'
                }`}
              >
                <span>پرداخت در محل / هنگام تحویل</span>
              </button>
            </div>

            {paymentMethod === 'stripe' && stripeEnabled && (
              <div className="p-3 rounded-xl bg-white border border-[#d2d2d7] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-indigo-700 flex items-center gap-1">
                    <Lock size={12} />
                    <span>درگاه امن Stripe ({store.stripe?.mode === 'live' ? 'Live' : 'Test'})</span>
                  </span>
                  {store.stripe?.mode !== 'live' && (
                    <button
                      type="button"
                      onClick={() => { setCardNumber('4242 4242 4242 4242'); setCardExpiry('12/28'); setCardCvc('424'); }}
                      className="text-[10.5px] font-bold text-[#0066CC] cursor-pointer"
                    >
                      پر کردن کارت تست
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full h-9 rounded-lg bg-[#f5f5f7] border border-[#e5e5ea] px-3 text-xs font-mono text-left"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="h-9 rounded-lg bg-[#f5f5f7] border border-[#e5e5ea] px-3 text-xs font-mono text-left"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="CVC"
                    className="h-9 rounded-lg bg-[#f5f5f7] border border-[#e5e5ea] px-3 text-xs font-mono text-left"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto h-10 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {submitting
              ? 'در حال ثبت سفارش...'
              : paymentMethod === 'stripe'
              ? `پرداخت ${totalAmount.toLocaleString('en-US')} ${store.currency} و ثبت سفارش`
              : `ثبت نهایی سفارش (${totalAmount.toLocaleString('en-US')} ${store.currency})`}
          </button>
        </form>
      )}
    </div>
  );
}
