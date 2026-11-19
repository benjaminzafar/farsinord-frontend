import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  KeyRound,
  Trash2,
  Edit3,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Save,
  Sparkles,
  Rocket,
  Clock,
  Crown,
  CheckCircle2,
  CalendarClock,
  Bell,
  Plus,
} from 'lucide-react';
import { publicApi } from '../lib/apiClient';
import {
  getSavedAdCredentials,
  saveAdCredential,
  removeAdCredential,
} from '../lib/myAdsStorage';
import {
  containsLinkInDescription,
  DESCRIPTION_LINK_ERROR_MSG,
} from '../lib/moderation';
import { t } from '../lib/translations';

function formatFaDateTime(isoStr, withTime = false) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function formatRemainingCountdown(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (sec <= 0) return 'هم‌اکنون آماده بوست';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} روز`);
  if (hours > 0) parts.push(`${hours} ساعت`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} دقیقه`);
  return parts.join(' و ');
}

function getStatusBadge(ad) {
  if (ad?.deleted_at || ad?.status === 'deleted') {
    return { label: 'حذف‌شده', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
  }
  switch (ad?.status) {
    case 'active':
      return { label: 'منتشرشده', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'pending':
      return { label: 'در انتظار تایید', cls: 'bg-amber-100 text-amber-900 border-amber-200' };
    case 'rejected':
      return { label: 'رد شده', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
    case 'hidden':
      return { label: 'مخفی‌شده', cls: 'bg-stone-200 text-stone-700 border-stone-300' };
    case 'sold':
      return { label: 'فروخته شد', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'rented':
      return { label: 'اجاره داده شد', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    default:
      return { label: ad?.status || 'نامشخص', cls: 'bg-stone-200 text-stone-700 border-stone-300' };
  }
}

const IGNORED_EMPTY_PRICE_TYPES = new Set(['kr', '€', 'sek', 'nok', 'dkk', 'eur', 'usd', '$', 'کرون', 'یورو', 'توافقی']);
function formatManageAdPrice(ad) {
  const rawType = String(ad?.price_type || '').trim();
  const numericPrice = Number(ad?.price);
  if (Number.isFinite(numericPrice) && numericPrice > 0) {
    return `${numericPrice.toLocaleString('fa-IR')} ${!rawType || rawType === 'kr' || rawType === 'توافقی' || rawType === 'توافقی_کاربر' ? 'کرون' : rawType}`;
  }
  const hasExplicitUserTavafoghi =
    rawType === 'توافقی_کاربر' ||
    /توافقی/.test(`${ad?.title || ''} ${ad?.title_fa || ''} ${ad?.description || ''}`);
  if (hasExplicitUserTavafoghi) {
    return 'توافقی';
  }
  if (rawType && !IGNORED_EMPTY_PRICE_TYPES.has(rawType.toLowerCase())) {
    return rawType;
  }
  return '';
}

export default function ManageAdModal({
  lang = 'fa',
  initialRef = '',
  lifecycleSettings = null,
  onClose,
  onDeleted,
  onUpdated,
  onBoosted,
  onOpenPromote,
}) {
  const currentT = t[lang] || t.fa;
  const freeBoostDays = Number.isInteger(Number(lifecycleSettings?.freeBoostCooldownDays)) && Number(lifecycleSettings?.freeBoostCooldownDays) >= 1
    ? Number(lifecycleSettings.freeBoostCooldownDays)
    : 7;
  const freeBoostDaysFa = String(freeBoostDays).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

  const [savedCreds, setSavedCreds] = useState(() => getSavedAdCredentials());
  const [dashboardAds, setDashboardAds] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(() => getSavedAdCredentials().length > 0);
  const [showLookupForm, setShowLookupForm] = useState(() => Boolean(initialRef) || getSavedAdCredentials().length === 0);

  // Auth step
  const [refInput, setRefInput] = useState(() => String(initialRef || '').trim().toUpperCase());
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [matchedAd, setMatchedAd] = useState(null);
  const [matchedPin, setMatchedPin] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Edit fields
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editPhone, setEditPhone] = useState('');
  const editDescHasLink = containsLinkInDescription(editDesc);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const loadDashboard = useCallback(async (creds) => {
    const list = creds || getSavedAdCredentials();
    if (list.length === 0) {
      setDashboardAds([]);
      setDashboardLoading(false);
      return;
    }
    try {
      const res = await publicApi.listOwnerAds(list);
      setDashboardAds(Array.isArray(res?.ads) ? res.ads : []);
    } catch {
      // Keep dashboard resilient cleanly
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const creds = getSavedAdCredentials();
    if (creds.length > 0) {
      publicApi
        .listOwnerAds(creds)
        .then((res) => {
          if (active) setDashboardAds(Array.isArray(res?.ads) ? res.ads : []);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setDashboardLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, []);

  // Live cooldown countdown ticker (every 30s when modal is open)
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const populateEditFields = (ad) => {
    setEditTitle(ad.title_fa || ad.title || '');
    setEditPrice(ad.price ?? '');
    setEditArea(ad.area || '');
    setEditDesc(ad.description || '');
    setEditStatus(ad.status || 'active');
    setEditPhone(ad.contact_phone || '');
  };

  const openAdDetailFromDashboard = (ad) => {
    const cred = savedCreds.find(
      (c) => String(c.reference_number).toUpperCase() === String(ad.reference_number).toUpperCase()
    );
    if (!cred) return;
    setErrorMsg('');
    setActionSuccessMsg('');
    setConfirmDelete(false);
    setIsEditing(false);
    setMatchedAd(ad);
    setMatchedPin(cred.pin_code);
    setNotifications(ad.notifications || []);
    populateEditFields(ad);
  };

  // Find ad by reference number and verify PIN securely on backend
  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setActionSuccessMsg('');
    const cleanRef = refInput.trim().toUpperCase();
    const cleanPin = pinInput.trim();

    if (!cleanRef || !cleanPin) {
      setErrorMsg('لطفاً کد پیگیری و پین کد را وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const res = await publicApi.verifyAdPin(cleanRef, cleanPin);
      if (!res?.ad) {
        throw new Error('شماره مرجع یا پین کد وارد شده صحیح نیست.');
      }
      saveAdCredential({
        reference_number: res.ad.reference_number,
        pin_code: cleanPin,
        title: res.ad.title_fa || res.ad.title,
      });
      setSavedCreds(getSavedAdCredentials());
      setMatchedAd(res.ad);
      setMatchedPin(cleanPin);
      setNotifications(res.notifications || []);
      populateEditFields(res.ad);
      loadDashboard(getSavedAdCredentials());
    } catch (err) {
      setErrorMsg(err.message || 'شماره مرجع یا پین کد وارد شده صحیح نیست.');
    } finally {
      setLoading(false);
    }
  };

  // Free Boost / VIP Refresh
  const handleFreeBoost = async (targetAd = matchedAd, targetPin = matchedPin) => {
    if (!targetAd || !targetPin) return;
    setErrorMsg('');
    setActionSuccessMsg('');
    setBoostLoading(true);

    try {
      const res = await publicApi.boostAd(targetAd.id, targetPin);
      const updated = res.ad;
      if (updated) {
        if (matchedAd && matchedAd.id === updated.id) {
          setMatchedAd(updated);
        }
        setDashboardAds((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
        if (onBoosted) onBoosted(updated);
        else if (onUpdated) onUpdated(updated);
      }
      setActionSuccessMsg(res.message || 'آگهی شما با موفقیت بوست شد و در صدر آگهی‌های جدید قرار گرفت.');
    } catch (err) {
      setErrorMsg(err.message || 'امکان بوست آگهی در حال حاضر وجود ندارد.');
      if (err.next_free_boost_at && matchedAd && matchedAd.id === targetAd.id) {
        setMatchedAd((prev) =>
          prev
            ? {
                ...prev,
                next_free_boost_at: err.next_free_boost_at,
                can_free_boost: false,
              }
            : prev
        );
      }
    } finally {
      setBoostLoading(false);
    }
  };

  // Soft delete ad via backend RPC
  const handleDeleteAd = async () => {
    if (!matchedAd || !matchedPin) return;
    setLoading(true);
    setErrorMsg('');

    try {
      await publicApi.deleteAd(matchedAd.id, matchedPin);
      removeAdCredential(matchedAd.reference_number);
      setSavedCreds(getSavedAdCredentials());
      setDashboardAds((prev) => prev.filter((a) => a.id !== matchedAd.id));
      setDeleteSuccess(true);
      if (onDeleted) {
        onDeleted(matchedAd.id);
      }
    } catch (err) {
      setErrorMsg(err.message || 'امکان حذف آگهی وجود ندارد.');
    } finally {
      setLoading(false);
    }
  };

  // Save edits via backend RPC (server updates last_meaningful_activity_at & clears cleanup warning)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!matchedAd || !matchedPin) return;
    if (containsLinkInDescription(editDesc)) {
      setErrorMsg(DESCRIPTION_LINK_ERROR_MSG);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setActionSuccessMsg('');

    try {
      const res = await publicApi.updateAd({
        id: matchedAd.id,
        reference_number: matchedAd.reference_number,
        pin_code: matchedPin,
        country: matchedAd.country,
        category: matchedAd.category,
        city: matchedAd.city,
        title: editTitle.trim(),
        price: editPrice === '' ? null : editPrice,
        area: editArea.trim(),
        description: editDesc.trim(),
        status: editStatus,
        contact_phone: editPhone.trim(),
      });
      const updated = res.ad;
      setMatchedAd(updated);
      setIsEditing(false);
      setDashboardAds((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setActionSuccessMsg(
        res.meaningful_activity_recorded
          ? 'تغییرات ذخیره شد و تاریخ آخرین فعالیت آگهی بروزرسانی گردید.'
          : 'اطلاعات آگهی ذخیره شد.'
      );
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ذخیره تغییرات آگهی.');
    } finally {
      setLoading(false);
    }
  };

  const renderBoostPanel = () => {
    if (!matchedAd) return null;
    const isActiveVip = Boolean(matchedAd.is_active_vip);
    const isDeleted = Boolean(matchedAd.deleted_at || matchedAd.status === 'deleted');
    const isApprovedActive = matchedAd.status === 'active' && !isDeleted;
    const nextBoostMs = matchedAd.next_free_boost_at ? Date.parse(matchedAd.next_free_boost_at) : 0;
    const cooldownSeconds = !isActiveVip && nextBoostMs > nowMs ? Math.ceil((nextBoostMs - nowMs) / 1000) : 0;
    const canBoostNow = isApprovedActive && (isActiveVip || cooldownSeconds === 0);

    return (
      <div className="rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7] p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
              isActiveVip ? 'bg-amber-100 text-amber-700' : canBoostNow ? 'bg-[#0066CC] text-white' : 'bg-white text-[#6E6E73] border border-[#E5E5EA]'
            }`}>
              {isActiveVip ? <Crown size={18} /> : <Rocket size={18} />}
            </div>
            <div>
              <h4 className="text-xs sm:text-[13px] font-black text-[#1D1D1F]">
                {isActiveVip ? 'بوست آگهی ویژه (VIP)' : `بوست رایگان (هر ${freeBoostDaysFa} روز)`}
              </h4>
              <p className="text-[11px] text-[#6E6E73]">
                {isActiveVip
                  ? 'آگهی‌های ویژه محدودیت زمانی بوست ندارند.'
                  : 'انتقال رایگان آگهی به صدر فهرست جدیدترین‌ها.'}
              </p>
            </div>
          </div>

          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
            isActiveVip
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : canBoostNow
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-[#6E6E73] border-[#E5E5EA]'
          }`}>
            {isActiveVip ? 'معافیت VIP' : canBoostNow ? 'آماده بوست' : !isApprovedActive ? 'غیرفعال' : 'در دوره انتظار'}
          </span>
        </div>

        {/* Metadata timeline grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-white border border-[#E5E5EA] px-3 py-2">
            <span className="block text-[10px] text-[#86868B]">آخرین بوست</span>
            <span className="font-bold text-[#1D1D1F]">
              {matchedAd.last_boosted_at ? formatFaDateTime(matchedAd.last_boosted_at, true) : 'تاکنون بوست نشده'}
            </span>
          </div>
          <div className="rounded-xl bg-white border border-[#E5E5EA] px-3 py-2">
            <span className="block text-[10px] text-[#86868B]">
              {isActiveVip ? 'انقضای اشتراک ویژه' : 'زمان بوست بعدی'}
            </span>
            <span className="font-bold text-[#1D1D1F]">
              {isActiveVip
                ? (matchedAd.promotion_expires_at ? formatFaDateTime(matchedAd.promotion_expires_at) : 'نامحدود')
                : cooldownSeconds > 0
                  ? formatFaDateTime(matchedAd.next_free_boost_at, true)
                  : 'هم‌اکنون در دسترس'}
            </span>
          </div>
        </div>

        {!isActiveVip && cooldownSeconds > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-950"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock size={14} className="text-amber-700 shrink-0" />
              <span>زمان باقی‌مانده تا بوست رایگان بعدی:</span>
            </div>
            <span className="font-black tabular-nums">{formatRemainingCountdown(cooldownSeconds)}</span>
          </div>
        )}

        {!isApprovedActive && !isDeleted && (
          <div className="rounded-xl bg-white border border-[#E5E5EA] px-3 py-2 text-[11px] text-[#6E6E73]">
            {matchedAd.status === 'pending'
              ? 'این آگهی هنوز در انتظار تایید مدیریت است؛ بوست رایگان پس از تایید فعال می‌شود.'
              : 'برای استفاده از بوست رایگان، وضعیت آگهی باید «فعال» باشد.'}
          </div>
        )}

        <button
          type="button"
          disabled={!canBoostNow || boostLoading || loading}
          onClick={() => handleFreeBoost(matchedAd, matchedPin)}
          aria-label="بوست رایگان آگهی"
          className={`w-full h-10 rounded-full font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            canBoostNow && !boostLoading
              ? 'bg-[#0066CC] hover:bg-[#0055AA] text-white shadow-xs active:scale-[0.98]'
              : 'bg-[#E5E5EA] text-[#86868B] cursor-not-allowed'
          }`}
        >
          <Rocket size={15} />
          <span>
            {boostLoading
              ? 'در حال ثبت بوست...'
              : isActiveVip
                ? 'بوست فوری آگهی ویژه'
                : cooldownSeconds > 0
                  ? `بوست بعدی در ${formatRemainingCountdown(cooldownSeconds)}`
                  : 'بوست رایگان آگهی'}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazir" dir="rtl">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-stone-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#6E6E73] shrink-0">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900">
                {matchedAd ? 'مدیریت آگهی' : 'آگهی‌های من'}
              </h2>
              <span className="text-[11px] font-medium text-stone-500">
                بوست رایگان، ویرایش و مدیریت وضعیت
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-200/60 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
          {deleteSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73]">
                <Trash2 size={28} />
              </div>
              <h3 className="text-xl font-black text-stone-900">
                {currentT.adDeletedSuccess}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                آگهی شما به بایگانی حذف منتقل شد و از فهرست عمومی سایت خارج گردید.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-stone-900 dark:bg-[#0A84FF] text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
                >
                  {currentT.close}
                </button>
              </div>
            </div>
          ) : !matchedAd ? (
            /* DASHBOARD & LOOKUP VIEW */
            <div className="space-y-5">
              {/* Saved User Ads Dashboard */}
              {savedCreds.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-[#1D1D1F]">
                      آگهی‌های ثبت‌شده در این مرورگر ({dashboardAds.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowLookupForm((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] hover:underline cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>{showLookupForm ? 'بستن فرم ورود دستی' : 'افزودن با کد پیگیری'}</span>
                    </button>
                  </div>

                  {dashboardLoading ? (
                    <div className="space-y-2">
                      <div className="h-24 rounded-2xl bg-[#F5F5F7] animate-pulse" />
                      <div className="h-24 rounded-2xl bg-[#F5F5F7] animate-pulse" />
                    </div>
                  ) : dashboardAds.length === 0 ? (
                    <div className="rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7] p-4 text-xs text-[#6E6E73] text-center">
                      اطلاعات آگهی‌های ذخیره‌شده یافت نشد. می‌توانید کد پیگیری و پین را در زیر وارد کنید.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {dashboardAds.map((ad) => {
                        const badge = getStatusBadge(ad);
                        const hasWarning = Boolean(ad.cleanup_warning_sent_at && !ad.deleted_at);
                        const nextBoostMs = ad.next_free_boost_at ? Date.parse(ad.next_free_boost_at) : 0;
                        const cdSec = !ad.is_active_vip && nextBoostMs > nowMs ? Math.ceil((nextBoostMs - nowMs) / 1000) : 0;
                        return (
                          <div
                            key={ad.id}
                            className="rounded-2xl border border-[#E5E5EA] bg-[#FBFBFC] p-3.5 space-y-2.5 hover:border-[#D2D2D7] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E5E5EA] text-[#1D1D1F]">
                                    <bdi>{ad.reference_number}</bdi>
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                  {ad.is_active_vip && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold">
                                      <Crown size={10} />
                                      <span>ویژه VIP</span>
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] truncate">
                                  {ad.title_fa || ad.title}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => openAdDetailFromDashboard(ad)}
                                className="shrink-0 h-8 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
                              >
                                مدیریت و بوست
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10.5px] text-[#6E6E73]">
                              <div className="bg-white rounded-lg px-2.5 py-1.5 border border-[#ECECEF]">
                                <span className="block text-[9.5px] text-[#86868B]">آخرین فعالیت</span>
                                <span className="font-semibold text-[#1D1D1F]">{formatFaDateTime(ad.last_meaningful_activity_at)}</span>
                              </div>
                              <div className="bg-white rounded-lg px-2.5 py-1.5 border border-[#ECECEF]">
                                <span className="block text-[9.5px] text-[#86868B]">وضعیت بوست</span>
                                <span className="font-semibold text-[#1D1D1F]">
                                  {ad.is_active_vip
                                    ? 'آزاد (VIP)'
                                    : ad.status !== 'active'
                                      ? 'پس از تایید'
                                      : cdSec > 0
                                        ? `${formatRemainingCountdown(cdSec)}`
                                        : 'آماده بوست رایگان'}
                                </span>
                              </div>
                              <div className="bg-white rounded-lg px-2.5 py-1.5 border border-[#ECECEF] col-span-2 sm:col-span-1">
                                <span className="block text-[9.5px] text-[#86868B]">اشتراک ویژه</span>
                                <span className="font-semibold text-[#1D1D1F]">
                                  {ad.is_active_vip
                                    ? `فعال تا ${formatFaDateTime(ad.promotion_expires_at)}`
                                    : 'عادی'}
                                </span>
                              </div>
                            </div>

                            {hasWarning && (
                              <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] text-rose-900">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CalendarClock size={14} className="text-rose-600 shrink-0" />
                                  <span className="truncate font-semibold">
                                    هشدار حذف در {formatFaDateTime(ad.scheduled_deletion_at)} (به‌دلیل عدم فعالیت)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openAdDetailFromDashboard(ad)}
                                  className="shrink-0 font-bold text-rose-700 underline cursor-pointer"
                                >
                                  تمدید / بوست
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Credential Lookup Form */}
              {showLookupForm && (
                <form onSubmit={handleVerify} className="space-y-3.5 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7]/70 p-4">
                  <div className="rounded-xl bg-amber-50/90 border border-amber-200/80 p-3 text-xs text-amber-900 leading-relaxed">
                    {currentT.enterRefPin}
                  </div>

                  {errorMsg && (
                    <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentT.referenceNo} *
                      </label>
                      <input
                        type="text"
                        required
                        dir="ltr"
                        placeholder="SP-2611-XXXX"
                        value={refInput}
                        onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 font-mono text-sm font-bold text-stone-900 uppercase focus:border-[#0066CC] focus:outline-none text-left"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {currentT.pinCode} *
                      </label>
                      <input
                        type="password"
                        maxLength={10}
                        required
                        dir="ltr"
                        placeholder="••••••••"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 font-mono text-sm font-bold text-stone-900 tracking-widest focus:border-[#0066CC] focus:outline-none text-left"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-slate-900 hover:bg-black text-white font-bold text-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? 'در حال بررسی...' : 'ورود به مدیریت آگهی'}</span>
                    <ArrowLeft size={15} />
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* SELECTED AD DETAIL, BOOST, EDIT & DELETE */
            <div className="space-y-4">
              {/* Ad Snapshot */}
              <div className="rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#E5E5EA] text-[#1D1D1F]">
                    <bdi>{matchedAd.reference_number}</bdi>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {matchedAd.is_active_vip && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10.5px] font-bold">
                        <Crown size={11} />
                        <span>ویژه VIP</span>
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${getStatusBadge(matchedAd).cls}`}>
                      {getStatusBadge(matchedAd).label}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-stone-900">
                    {matchedAd.title_fa || matchedAd.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-500 tabular-nums">
                    <span>{matchedAd.city}</span>
                    {formatManageAdPrice(matchedAd) && (
                      <>
                        <span>•</span>
                        <span><bdi>{formatManageAdPrice(matchedAd)}</bdi></span>
                      </>
                    )}
                    <span>•</span>
                    <span>{(matchedAd.views_count || 1).toLocaleString('fa-IR')} بازدید</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[#6E6E73]">
                    <span>تاریخ ثبت اولیه: <strong className="text-[#1D1D1F]">{formatFaDateTime(matchedAd.created_at)}</strong></span>
                    <span>آخرین فعالیت: <strong className="text-[#1D1D1F]">{formatFaDateTime(matchedAd.last_meaningful_activity_at, true)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Cleanup warning alert if active */}
              {matchedAd.cleanup_warning_sent_at && !matchedAd.deleted_at && (
                <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 flex items-start gap-2.5 text-xs text-rose-900">
                  <CalendarClock size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-black block">هشدار حذف خودکار به‌دلیل عدم فعالیت</span>
                    <p className="text-[11px] leading-relaxed">
                      این آگهی در تاریخ <strong>{formatFaDateTime(matchedAd.scheduled_deletion_at)}</strong> به صورت خودکار حذف می‌شود. با بوست رایگان یا ویرایش آگهی، هشدار لغو شده و آگهی فعال باقی می‌ماند.
                    </p>
                  </div>
                </div>
              )}

              {/* Success / Error messages */}
              {actionSuccessMsg && (
                <div role="status" aria-live="polite" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Free Boost Section */}
              {renderBoostPanel()}

              {/* Owner Notifications */}
              {notifications.length > 0 && (
                <div className="rounded-2xl border border-[#E5E5EA] bg-white p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1D1D1F]">
                    <Bell size={14} className="text-[#0066CC]" />
                    <span>اعلان‌های سیستم ({notifications.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="rounded-xl bg-[#F5F5F7] px-3 py-2 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#1D1D1F]">{n.title}</span>
                          <span className="text-[10px] text-[#86868B]">{formatFaDateTime(n.created_at)}</span>
                        </div>
                        <p className="text-[#515154] leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editing Form */}
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3 border-t border-stone-100 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">عنوان آگهی *</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-[#0066CC] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">قیمت (اختیاری)</label>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="مثال: 12000"
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-[#0066CC] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">محله / منطقه</label>
                      <input
                        type="text"
                        value={editArea}
                        onChange={(e) => setEditArea(e.target.value)}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-[#0066CC] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">وضعیت انتشار</label>
                      <select
                        value={editStatus}
                        disabled={matchedAd.status === 'pending' || matchedAd.status === 'rejected'}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs bg-white disabled:bg-stone-100 focus:border-[#0066CC] focus:outline-none"
                      >
                        {matchedAd.status === 'pending' ? (
                          <option value="pending">در انتظار تایید مدیر</option>
                        ) : (
                          <>
                            <option value="active">فعال (نمایش در سایت)</option>
                            <option value="hidden">مخفی موقت</option>
                            <option value="sold">فروخته شد</option>
                            <option value="rented">اجاره داده شد</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">شماره تماس</label>
                    <input
                      type="tel"
                      dir="ltr"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-left font-mono focus:border-[#0066CC] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">توضیحات کامل آگهی *</label>
                    <textarea
                      rows={3}
                      required
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className={`w-full rounded-xl border p-3 text-xs leading-relaxed focus:outline-none ${
                        editDescHasLink
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-stone-300 focus:border-[#0066CC]'
                      }`}
                    />
                    {editDescHasLink && (
                      <p role="alert" className="mt-1.5 text-[11px] font-bold text-rose-600">
                        {DESCRIPTION_LINK_ERROR_MSG}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={loading || editDescHasLink}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-2.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Save size={14} />
                      <span>{loading ? 'در حال ذخیره...' : 'ذخیره تغییرات و تمدید فعالیت'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(matchedAd.deleted_at)}
                      onClick={() => setIsEditing(true)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold text-xs py-2.5 border border-stone-200 active:scale-95 transition-all cursor-pointer"
                    >
                      <Edit3 size={15} />
                      <span>ویرایش اطلاعات آگهی</span>
                    </button>

                    {onOpenPromote && !matchedAd.deleted_at && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose?.();
                          onOpenPromote(matchedAd);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs py-2.5 border border-amber-200 active:scale-95 transition-all cursor-pointer"
                      >
                        <Sparkles size={15} className="text-amber-600" />
                        <span>{matchedAd.is_active_vip ? 'تمدید اشتراک ویژه (VIP)' : 'ارتقا به آگهی ویژه (VIP)'}</span>
                      </button>
                    )}
                  </div>

                  {!matchedAd.deleted_at && (
                    !confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2.5 border border-rose-200 active:scale-95 transition-all cursor-pointer"
                      >
                        <Trash2 size={15} />
                        <span>{currentT.deleteAd}</span>
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2 text-rose-900 text-xs font-bold">
                          <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                          <span>{currentT.confirmDelete}</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleDeleteAd}
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                            <span>{loading ? 'در حال حذف...' : 'بله، حذف شود'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="px-4 py-2 rounded-xl bg-stone-200 text-stone-800 font-bold text-xs hover:bg-stone-300 cursor-pointer"
                          >
                            انصراف
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMatchedAd(null);
                      setMatchedPin('');
                      setErrorMsg('');
                      setActionSuccessMsg('');
                      setConfirmDelete(false);
                      setIsEditing(false);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 pt-1.5 cursor-pointer"
                  >
                    <ArrowRight size={14} className="shrink-0" />
                    <span>بازگشت به آگهی‌های من</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
