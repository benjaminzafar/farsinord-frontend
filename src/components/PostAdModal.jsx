import React, { useState, useRef } from 'react';
import {
  X,
  PlusCircle,
  KeyRound,
  Check,
  Copy,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  FileText,
  MessageCircle,
  Send,
  Upload,
  Loader2,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  CopyCheck,
  HelpCircle,
  Lock,
  RefreshCw,
  Crown,
  Phone,
  Mail,
  Globe,
  Pencil,
} from 'lucide-react';
import CloudflareTurnstile from './CloudflareTurnstile';
import LocationMapPicker, { getCityDefaultCoords } from './LocationMapPicker';
import { isSafeHttpUrl } from '../lib/urlUtils';
import { publicApi } from '../lib/apiClient';
import { saveAdCredential } from '../lib/myAdsStorage';
import {
  checkProhibitedContent,
  containsLinkInDescription,
  DESCRIPTION_LINK_ERROR_MSG,
} from '../lib/moderation';
import {
  MAX_IMAGE_BYTES,
  compressImageForUpload,
} from '../lib/imageCompressor';
import { COUNTRIES, CATEGORIES, t, buildAdPolicyRules } from '../lib/translations';

async function computeFileSha256(file) {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return '';
    const buf = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

function generateClientPin() {
  try {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return String(10000000 + (arr[0] % 90000000));
    }
  } catch {}
  return String(10000000 + Math.floor(Math.random() * 90000000));
}

function normalizeAsciiDigits(str) {
  return String(str || '')
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const MAX_PHOTOS = 4;
const MAX_FILE_BYTES = MAX_IMAGE_BYTES; // 1 MB

const WIZARD_STEPS = [
  { num: 1, label: 'اطلاعات', Icon: FileText },
  { num: 2, label: 'موقعیت', Icon: MapPin },
  { num: 3, label: 'تماس', Icon: MessageCircle },
  { num: 4, label: 'انتشار', Icon: Send },
];

const INPUT_CLASS =
  'w-full h-11 rounded-xl border border-[#E5E5EA] dark:border-white/[0.1] bg-white dark:bg-[#121317] px-3.5 text-xs sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#6E6E73] focus:border-[#0066CC] dark:focus:border-[#388BFD] focus:ring-2 focus:ring-[#0066CC]/15 focus:outline-none transition-colors';

export default function PostAdModal({
  initialCategory = 'bostad',
  selectedCountry = 'se',
  countries = COUNTRIES,
  lifecycleSettings = null,
  turnstileSettings: propTurnstileSettings = null,
  onClose,
  onCreated,
  onOpenManageExisting,
}) {
  const currentT = t.fa;
  const fullPolicyRules = buildAdPolicyRules(lifecycleSettings || {});
  const policyRules = [fullPolicyRules[0], fullPolicyRules[2], fullPolicyRules[4]].filter(Boolean);
  const activeCountries =
    Array.isArray(countries) && countries.length > 0
      ? countries.filter((c) => c.enabled !== false)
      : COUNTRIES;

  const initialCountryId = selectedCountry === 'all' ? 'se' : (selectedCountry || 'se');
  const initialCountryObj =
    activeCountries.find((c) => c.id === initialCountryId) || activeCountries[0];
  const initialCityId =
    initialCountryObj.cities.find((c) => c.id !== 'all')?.id || 'Stockholm';

  const [step, setStep] = useState(1); // 1: Information | 2: Location | 3: Contact | 4: Publish
  const bodyScrollRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Step 1 — Information
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(initialCategory || 'bostad');
  const [description, setDescription] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState(initialCountryObj.currency || 'kr');
  const [imageUrl, setImageUrl] = useState('');
  const [imagesList, setImagesList] = useState([]);
  const [imageHashes, setImageHashes] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  // Step 2 — Location & Map
  const [adCountry, setAdCountry] = useState(initialCountryId);
  const [city, setCity] = useState(initialCityId);
  const [area, setArea] = useState('');
  const [mapCoords, setMapCoords] = useState(() =>
    getCityDefaultCoords(initialCityId, initialCountryId)
  );
  const [mapZoom, setMapZoom] = useState(13);
  const [mapConfirmed, setMapConfirmed] = useState(false);
  const [searchingMap, setSearchingMap] = useState(false);
  const [confirmingMap, setConfirmingMap] = useState(false);

  // Step 3 — Contact (all optional)
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [openHelp, setOpenHelp] = useState(null); // null | 'whatsapp' | 'telegram'

  // Step 4 — Publish
  const [wantVipPromotion, setWantVipPromotion] = useState(false);
  const [managePin, setManagePin] = useState(() => generateClientPin());
  const [pinCopiedPreview, setPinCopiedPreview] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [showRulesDetails, setShowRulesDetails] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [storedTurnstileSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_turnstile_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: true, protectPostAd: true, mode: 'test', siteKey: '' };
  });
  const turnstileSettings = propTurnstileSettings || storedTurnstileSettings;

  const currentCountryObj =
    activeCountries.find((c) => c.id === adCountry) || activeCountries[0];
  const currentCityObj = currentCountryObj.cities.find((c) => c.id === city);
  const currentCategoryObj = CATEGORIES.find((c) => c.id === category);
  const descriptionHasLink = containsLinkInDescription(description);
  const cleanPinCandidate = normalizeAsciiDigits(managePin).trim();
  const isPinValid = /^[0-9A-Za-z]{6,12}$/.test(cleanPinCandidate);

  const scrollBodyTop = () => {
    try {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  // Country & City selection updates default map center
  const handleSelectCountry = (c) => {
    setAdCountry(c.id);
    const firstCity = c.cities.find((ct) => ct.id !== 'all')?.id || '';
    setCity(firstCity);
    setPriceType(c.currency || 'kr');
    setMapCoords(getCityDefaultCoords(firstCity, c.id));
    setMapZoom(12);
    setMapConfirmed(false);
  };

  const handleSelectCity = (nextCity) => {
    setCity(nextCity);
    setMapCoords(getCityDefaultCoords(nextCity, adCountry));
    setMapZoom(13);
    setMapConfirmed(false);
  };

  const handleSearchAddressOnMap = async () => {
    const queryParts = [area.trim(), city].filter(Boolean).join(', ');
    if (queryParts.length < 2) return;
    setSearchingMap(true);
    try {
      const res = await publicApi.geocodeLocation({ q: queryParts, country: adCountry });
      if (res && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
        setMapCoords({ lat: res.lat, lng: res.lng });
        setMapZoom(15);
        setMapConfirmed(false);
      }
    } finally {
      setSearchingMap(false);
    }
  };

  const handleConfirmMapLocation = async () => {
    setConfirmingMap(true);
    try {
      setMapConfirmed(true);
      if (!area.trim()) {
        const label = await publicApi.reverseGeocodeLocation({
          lat: mapCoords.lat,
          lng: mapCoords.lng,
        });
        if (label) {
          setArea(label);
        }
      }
    } finally {
      setConfirmingMap(false);
    }
  };

  // Photo upload helpers (preserved intact)
  const addImage = () => {
    setErrorMsg('');
    if (imagesList.length >= MAX_PHOTOS) {
      setErrorMsg('حداکثر ۴ تصویر برای هر آگهی مجاز است.');
      return;
    }
    const trimmed = imageUrl.trim();
    if (trimmed) {
      if (!isSafeHttpUrl(trimmed)) {
        setErrorMsg('لطفاً یک لینک تصویر معتبر (https://...) وارد فرمایید.');
        return;
      }
      setImagesList([...imagesList, trimmed]);
      setImageUrl('');
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (selectedFiles.length === 0) return;

    setErrorMsg('');
    const remainingSlots = MAX_PHOTOS - imagesList.length;
    if (remainingSlots <= 0) {
      setErrorMsg('حداکثر ۴ تصویر برای هر آگهی مجاز است.');
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setErrorMsg(`فقط ${remainingSlots} تصویر دیگر می‌توانید اضافه کنید (حداکثر ۴ تصویر).`);
    }

    setUploadingPhotos(true);
    try {
      const results = await Promise.all(
        filesToUpload.map(async (rawFile) => {
          if (!rawFile.type.startsWith('image/')) {
            throw new Error('فقط فایل‌های تصویری مجاز هستند.');
          }
          const readyFile = await compressImageForUpload(rawFile, { maxBytes: MAX_FILE_BYTES });
          if (readyFile.size > MAX_FILE_BYTES) {
            throw new Error('حجم هر تصویر باید حداکثر ۱ مگابایت باشد.');
          }
          const [fileHash, presignData] = await Promise.all([
            computeFileSha256(readyFile),
            publicApi.presignUpload({
              fileName: readyFile.name,
              contentType: readyFile.type,
              fileSize: readyFile.size,
            }),
          ]);
          const putHeaders = { 'Content-Type': readyFile.type };
          if (presignData.cacheControl) {
            putHeaders['Cache-Control'] = presignData.cacheControl;
          }
          const putRes = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: putHeaders,
            body: readyFile,
          });
          if (!putRes.ok) {
            throw new Error('خطا در ارسال تصویر به فضای ابری');
          }
          return { publicUrl: presignData.publicUrl, fileHash };
        })
      );
      const uploadedUrls = results.map((r) => r.publicUrl).filter(Boolean);
      const uploadedHashes = results.map((r) => r.fileHash).filter(Boolean);
      if (uploadedUrls.length > 0) {
        setImagesList((prev) => [...prev, ...uploadedUrls].slice(0, MAX_PHOTOS));
        if (uploadedHashes.length > 0) {
          setImageHashes((prev) => [...prev, ...uploadedHashes].slice(0, MAX_PHOTOS));
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'خطا در آپلود تصویر');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removeImage = (index) => {
    setImagesList(imagesList.filter((_, i) => i !== index));
    setImageHashes(imageHashes.filter((_, i) => i !== index));
  };

  const goToStep = (targetStep) => {
    setErrorMsg('');
    setOpenHelp(null);
    setStep(targetStep);
    scrollBodyTop();
  };

  const handleNextStep = () => {
    setErrorMsg('');
    setOpenHelp(null);

    if (step === 1) {
      if (!title.trim() || !category || !description.trim()) {
        setErrorMsg('لطفاً عنوان، دسته‌بندی و توضیحات کوتاه آگهی را وارد کنید.');
        return;
      }
      if (containsLinkInDescription(description)) {
        setErrorMsg(DESCRIPTION_LINK_ERROR_MSG);
        return;
      }
      const modCheck = checkProhibitedContent({ title, description });
      if (modCheck.blocked) {
        setErrorMsg(modCheck.reason);
        return;
      }
      setStep(2);
      scrollBodyTop();
      return;
    }

    if (step === 2) {
      if (!adCountry || !city) {
        setErrorMsg('لطفاً کشور و شهر محل آگهی را انتخاب کنید.');
        return;
      }
      setStep(3);
      scrollBodyTop();
      return;
    }

    if (step === 3) {
      const trimmedSite = contactWebsite.trim();
      if (trimmedSite && !isSafeHttpUrl(/^https?:\/\//i.test(trimmedSite) ? trimmedSite : `https://${trimmedSite}`)) {
        setErrorMsg('آدرس وب‌سایت وارد شده معتبر نیست.');
        return;
      }
      setStep(4);
      scrollBodyTop();
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setOpenHelp(null);
    if (step > 1) {
      setStep(step - 1);
      scrollBodyTop();
    }
  };

  const submitAd = async ({ requestDuplicateReview = false } = {}) => {
    setErrorMsg('');
    if (!requestDuplicateReview) setDuplicateWarning(null);

    if (!title.trim() || !description.trim()) {
      setErrorMsg('لطفاً عنوان و توضیحات آگهی را وارد کنید.');
      setStep(1);
      return;
    }

    if (containsLinkInDescription(description)) {
      setErrorMsg(DESCRIPTION_LINK_ERROR_MSG);
      setStep(1);
      return;
    }

    if (!isPinValid) {
      setErrorMsg('کد مدیریت باید بین ۶ تا ۱۲ عدد یا حرف انگلیسی باشد.');
      return;
    }

    if (!rulesAccepted) {
      setErrorMsg('لطفاً قوانین انتشار آگهی را تایید کنید.');
      return;
    }

    const modCheck = checkProhibitedContent({ title, description, area });
    if (modCheck.blocked) {
      setErrorMsg(modCheck.reason);
      return;
    }

    const turnstileRequired =
      turnstileSettings.enabled !== false && turnstileSettings.protectPostAd !== false;
    if (turnstileRequired && !turnstileToken) {
      setErrorMsg('لطفاً تایید امنیتی (من ربات نیستم) را کامل کنید.');
      return;
    }

    setLoading(true);

    try {
      const allImages = imagesList.filter(isSafeHttpUrl);
      if (imageUrl.trim() && isSafeHttpUrl(imageUrl.trim())) {
        allImages.push(imageUrl.trim());
      }

      const rawPriceTrimmed = String(price || '').trim();
      const userTypedTavafoghi =
        /توافقی/.test(rawPriceTrimmed) || /توافقی/.test(String(priceType || ''));
      const normalizedPriceDigits = normalizeAsciiDigits(rawPriceTrimmed).replace(/,/g, '');
      const parsedNumPrice = parseFloat(normalizedPriceDigits);
      const hasValidNumPrice = Number.isFinite(parsedNumPrice) && parsedNumPrice > 0;

      const trimmedWebsite = contactWebsite.trim();
      const normalizedWebsite = trimmedWebsite
        ? (/^https?:\/\//i.test(trimmedWebsite) ? trimmedWebsite : `https://${trimmedWebsite}`)
        : null;

      const res = await publicApi.createAd({
        title: title.trim(),
        category,
        country: adCountry,
        city,
        area: area.trim() || null,
        price: hasValidNumPrice ? parsedNumPrice : null,
        price_type: !hasValidNumPrice && userTypedTavafoghi ? 'توافقی_کاربر' : priceType,
        description: description.trim(),
        contact_name: 'آگهی‌دهنده',
        contact_phone: contactPhone.trim() || null,
        contact_whatsapp: contactWhatsapp.trim() || null,
        contact_telegram: contactTelegram.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_website: normalizedWebsite && isSafeHttpUrl(normalizedWebsite) ? normalizedWebsite : null,
        images: allImages,
        image_hashes: imageHashes,
        pin_code: cleanPinCandidate,
        requestDuplicateReview,
        turnstileToken,
      });

      saveAdCredential({
        reference_number: res.reference_number,
        pin_code: res.pin_code,
        title: title.trim(),
      });

      setDuplicateWarning(null);
      setSuccessData({
        referenceNumber: res.reference_number,
        pinCode: res.pin_code,
        ad: res.ad,
        duplicateReviewFlagged: Boolean(res.duplicateReviewFlagged),
      });

      if (onCreated) {
        onCreated(res.ad, wantVipPromotion);
      }
    } catch (err) {
      console.error('Error posting ad:', err);
      if (err.code === 'DUPLICATE_AD' && err.duplicateMatch) {
        setDuplicateWarning({
          ...err.duplicateMatch,
          reasons: err.reasons || [],
          message: err.message,
        });
        scrollBodyTop();
      } else {
        setErrorMsg(err.message || 'خطا در ثبت آگهی. لطفاً دوباره تلاش فرمایید.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 4) {
      handleNextStep();
      return;
    }
    await submitAd({ requestDuplicateReview: false });
  };

  const copyToClipboard = (text, type) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    if (type === 'ref') {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } else if (type === 'previewPin') {
      setPinCopiedPreview(true);
      setTimeout(() => setPinCopiedPreview(false), 2000);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const activeContacts = [
    contactTelegram.trim() && { label: 'تلگرام', value: contactTelegram.trim(), Icon: Send },
    contactWhatsapp.trim() && { label: 'واتساپ', value: contactWhatsapp.trim(), Icon: MessageCircle },
    contactEmail.trim() && { label: 'ایمیل', value: contactEmail.trim(), Icon: Mail },
    contactPhone.trim() && { label: 'تلفن', value: contactPhone.trim(), Icon: Phone },
    contactWebsite.trim() && { label: 'وب‌سایت', value: contactWebsite.trim(), Icon: Globe },
  ].filter(Boolean);

  const vipPriceLabel = currentCountryObj.currency === '€' ? '۹ یورو (€)' : '۹۹ کرون';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazir"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Centered Modal Box (Mobile & Desktop) */}
      <div className="relative w-full max-w-xl bg-[#FBFBFC] dark:bg-[#171920] rounded-3xl shadow-2xl border border-[#ECEFF4] dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[90dvh] z-10 animate-in zoom-in-95 duration-150">
        {/* Clean Compact Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#ECEFF4] dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF] shrink-0">
              <PlusCircle size={19} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-[#1D1D1F] dark:text-white leading-tight truncate">
                {currentT.postAdBtn}
              </h2>
              <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989F]">
                {successData ? 'ثبت نهایی انجام شد' : `مرحله ${step.toLocaleString('fa-IR')} از ۴`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* 4-Step Progress Indicator: 1 اطلاعات → 2 موقعیت → 3 تماس → 4 انتشار */}
        {!successData && (
          <div className="px-4 sm:px-6 pt-3 pb-3 bg-[#FBFBFC] dark:bg-[#171920] border-b border-[#ECEFF4] dark:border-white/[0.06] shrink-0 space-y-2.5">
            <div className="grid grid-cols-4 gap-1.5">
              {WIZARD_STEPS.map((s) => {
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={s.num > step}
                    onClick={() => {
                      if (s.num < step) goToStep(s.num);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold leading-none transition-all duration-200 ${
                      isCurrent
                        ? 'bg-[#0066CC] text-white shadow-xs'
                        : isDone
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/25 cursor-pointer active:scale-95'
                          : 'bg-[#F5F5F7] dark:bg-white/[0.04] text-[#86868B] dark:text-[#6E6E73] cursor-default'
                    }`}
                  >
                    <span
                      className={`flex h-4.5 w-4.5 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black leading-none ${
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#E5E5EA] dark:bg-white/[0.08] text-[#6E6E73] dark:text-[#86868B]'
                      }`}
                    >
                      {isDone ? <Check size={10} strokeWidth={3} /> : s.num.toLocaleString('fa-IR')}
                    </span>
                    <span className="truncate leading-none">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="h-1 w-full rounded-full bg-[#ECEFF4] dark:bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0066CC] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <form id="post-ad-wizard-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div
            ref={bodyScrollRef}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 custom-scrollbar space-y-4"
          >
            {successData ? (
              /* SUCCESS SCREEN */
              <div className="py-5 text-center space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check size={28} strokeWidth={2.5} />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1D1D1F] dark:text-white">
                    آگهی شما ثبت شد و در انتظار تایید است
                  </h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] max-w-sm mx-auto leading-relaxed">
                    {successData.duplicateReviewFlagged
                      ? 'درخواست بررسی آگهی مشابه ثبت شد و پس از تایید مدیر منتشر می‌شود.'
                      : currentT.saveYourCredentials}
                  </p>
                </div>

                <div className="max-w-md mx-auto rounded-2xl bg-[#F5F5F7] dark:bg-[#121317] border border-[#E5E5EA] dark:border-white/[0.08] divide-y divide-[#E5E5EA] dark:divide-white/[0.06] overflow-hidden text-right">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10px] font-bold text-[#86868B]">
                        {currentT.referenceNo}
                      </span>
                      <span className="font-mono text-base font-black text-[#1D1D1F] dark:text-white tracking-wider">
                        <bdi>{successData.referenceNumber}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.referenceNumber, 'ref')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedRef ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      <span>{copiedRef ? currentT.copied : currentT.copyRef}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10px] font-bold text-[#86868B]">
                        {currentT.pinCode}
                      </span>
                      <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400 tracking-widest">
                        <bdi>{successData.pinCode}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.pinCode, 'pin')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedPin ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      <span>{copiedPin ? currentT.copied : currentT.copyPin}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11.5px] text-[#6E6E73] dark:text-[#A1A1A6] px-4 py-3">
                    <KeyRound size={14} className="shrink-0 text-[#86868B]" />
                    <span>با این دو کد می‌توانید هر زمان آگهی را ویرایش یا حذف کنید.</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-7 h-10 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
                >
                  {currentT.close}
                </button>
              </div>
            ) : (
              <>
                {/* Error Alert */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300 font-semibold"
                  >
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Duplicate Ad Warning */}
                {duplicateWarning && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-300 dark:border-amber-500/35 bg-amber-50/90 dark:bg-amber-500/10 p-4 space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-start gap-2.5">
                      <CopyCheck size={18} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-[13px] font-black text-amber-950 dark:text-amber-200">
                            آگهی مشابه یا تکراری شناسایی شد
                          </h4>
                          {duplicateWarning.score && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-500/25 text-amber-950 dark:text-amber-200 text-[10.5px] font-extrabold tabular-nums">
                              تشابه {Math.round(duplicateWarning.score * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-amber-900 dark:text-amber-300/90 leading-relaxed">
                          {duplicateWarning.message}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-[#121317] border border-amber-200/80 dark:border-white/[0.08] p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-[#1D1D1F] dark:text-white truncate">
                          {duplicateWarning.title}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#0066CC] dark:text-[#58A6FF] bg-blue-50 dark:bg-[#0066CC]/15 px-2 py-0.5 rounded-md">
                          <bdi>{duplicateWarning.reference_number}</bdi>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] dark:text-[#98989F]">
                        <span>{duplicateWarning.city}</span>
                        <span>•</span>
                        <span>{duplicateWarning.status === 'active' ? 'منتشر شده' : 'در انتظار تایید'}</span>
                      </div>
                      {Array.isArray(duplicateWarning.reasons) && duplicateWarning.reasons.length > 0 && (
                        <ul className="pt-1 space-y-0.5 text-[11px] text-amber-900 dark:text-amber-300 list-disc list-inside">
                          {duplicateWarning.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenManageExisting) {
                            onOpenManageExisting(duplicateWarning.reference_number);
                          }
                        }}
                        className="flex-1 h-9 px-3 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Sparkles size={13} />
                        <span>ویرایش یا بوست رایگان آگهی قبلی</span>
                      </button>
                      {duplicateWarning.status === 'active' && (
                        <a
                          href={`/?ad=${encodeURIComponent(duplicateWarning.reference_number)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3 rounded-xl bg-white dark:bg-white/[0.06] border border-amber-300 dark:border-amber-500/30 hover:bg-amber-100/60 text-amber-950 dark:text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink size={13} />
                          <span>مشاهده آگهی</span>
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => submitAd({ requestDuplicateReview: true })}
                      className="w-full py-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 hover:underline cursor-pointer text-center"
                    >
                      این آگهی کاملاً متفاوت است — ارسال جهت بررسی مدیر
                    </button>
                  </div>
                )}

                {/* ======================================================
                    STEP 1 — INFORMATION (Clean & Minimal)
                ====================================================== */}
                {step === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        عنوان آگهی <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: اجاره آپارتمان ۲ خوابه یا خدمات حسابداری..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        دسته‌بندی <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={INPUT_CLASS}
                      >
                        {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fa}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Short Description */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        توضیحات کوتاه <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="مشخصات اصلی، شرایط یا ساعات کار را کوتاه و شفاف بنویسید..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full rounded-xl border bg-white dark:bg-[#121317] p-3.5 text-xs sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 leading-relaxed transition-colors ${
                          descriptionHasLink
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-[#E5E5EA] dark:border-white/[0.1] focus:border-[#0066CC] dark:focus:border-[#388BFD] focus:ring-[#0066CC]/15'
                        }`}
                      />
                      {descriptionHasLink && (
                        <p role="alert" className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          {DESCRIPTION_LINK_ERROR_MSG}
                        </p>
                      )}
                    </div>

                    {/* Compact Optional Drawer: Price & Photos (Preserves full functionality without cluttering Step 1) */}
                    <div className="rounded-2xl border border-[#ECEFF4] dark:border-white/[0.08] bg-[#F5F5F7]/70 dark:bg-white/[0.03] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowExtras((v) => !v)}
                        className="w-full flex items-center justify-between px-3.5 py-3 text-right cursor-pointer hover:bg-[#F0F2F5]/70 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ImageIcon size={15} className="text-[#0066CC] dark:text-[#58A6FF] shrink-0" />
                          <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                            افزودن عکس یا قیمت
                          </span>
                          <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-white dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#98989F] shrink-0">
                            اختیاری
                          </span>
                          {imagesList.length > 0 && (
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF] shrink-0">
                              {imagesList.length.toLocaleString('fa-IR')} عکس
                            </span>
                          )}
                          {price.trim() && (
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0 truncate max-w-[90px]">
                              {price.trim()}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          size={15}
                          className={`text-[#86868B] shrink-0 transition-transform duration-200 ${
                            showExtras ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {showExtras && (
                        <div className="px-3.5 pb-4 pt-2 border-t border-[#ECEFF4] dark:border-white/[0.06] space-y-3.5 animate-in fade-in duration-150">
                          {/* Optional Price */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2 space-y-1">
                              <label className="block text-[11px] font-bold text-[#515154] dark:text-[#A1A1A6]">
                                قیمت (اختیاری)
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="مثال: 12000 یا توافقی"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-[#515154] dark:text-[#A1A1A6]">
                                واحد
                              </label>
                              <input
                                type="text"
                                value={priceType}
                                onChange={(e) => setPriceType(e.target.value)}
                                placeholder={currentCountryObj.currency}
                                className={INPUT_CLASS}
                              />
                            </div>
                          </div>

                          {/* Optional Photos */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#515154] dark:text-[#A1A1A6]">
                                تصاویر آگهی (حداکثر ۴ عکس)
                              </span>
                              <span className="text-[10.5px] font-semibold text-[#86868B] tabular-nums">
                                {imagesList.length.toLocaleString('fa-IR')} از ۴
                              </span>
                            </div>

                            {imagesList.length < MAX_PHOTOS && (
                              <label
                                className={`flex items-center justify-center gap-2.5 rounded-xl border border-dashed p-3.5 text-center transition-all cursor-pointer ${
                                  uploadingPhotos
                                    ? 'border-[#0066CC]/40 bg-[#EAF2FB]/40 dark:bg-[#0066CC]/10 pointer-events-none'
                                    : 'border-[#D2D2D7] dark:border-white/[0.14] hover:border-[#0066CC] bg-white dark:bg-[#121317]'
                                }`}
                              >
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/avif"
                                  multiple
                                  disabled={uploadingPhotos}
                                  onChange={handleFileUpload}
                                  className="hidden"
                                />
                                {uploadingPhotos ? (
                                  <>
                                    <Loader2 size={16} className="text-[#0066CC] animate-spin shrink-0" />
                                    <span className="text-xs font-bold text-[#0066CC] dark:text-[#58A6FF]">
                                      در حال آپلود تصویر...
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Upload size={16} className="text-[#86868B] shrink-0" />
                                    <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                      انتخاب عکس از گالری
                                    </span>
                                  </>
                                )}
                              </label>
                            )}

                            {imagesList.length > 0 && (
                              <div className="grid grid-cols-4 gap-2">
                                {imagesList.map((url, idx) => (
                                  <div
                                    key={idx}
                                    className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E5EA] dark:border-white/[0.1] bg-[#ECECEF] dark:bg-[#121317]"
                                  >
                                    <img
                                      src={url}
                                      alt={`تصویر ${idx + 1}`}
                                      className="h-full w-full object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeImage(idx)}
                                      className="absolute top-1 end-1 h-5 w-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                                      title="حذف تصویر"
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setShowUrlFallback((v) => !v)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989F] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                            >
                              <span>{showUrlFallback ? 'بستن لینک تصویر' : '+ افزودن با لینک مستقیم'}</span>
                            </button>

                            {showUrlFallback && (
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  dir="ltr"
                                  placeholder="https://..."
                                  value={imageUrl}
                                  onChange={(e) => setImageUrl(e.target.value)}
                                  className="flex-1 h-9 rounded-xl border border-[#E5E5EA] dark:border-white/[0.1] bg-white dark:bg-[#121317] px-3 text-xs text-[#1D1D1F] dark:text-white focus:border-[#0066CC] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={addImage}
                                  className="h-9 px-3.5 rounded-xl bg-[#ECECEF] dark:bg-white/[0.08] hover:bg-[#E2E2E7] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white text-xs font-bold cursor-pointer"
                                >
                                  افزودن
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 2 — LOCATION (Country, City, Address & Map Pin)
                ====================================================== */}
                {step === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Country */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        کشور <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {activeCountries.map((c) => {
                          const selected = adCountry === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCountry(c)}
                              className={`h-9 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer truncate ${
                                selected
                                  ? 'bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF] border-[#0066CC] dark:border-[#388BFD]'
                                  : 'bg-white dark:bg-[#121317] text-[#515154] dark:text-[#A1A1A6] border-[#E5E5EA] dark:border-white/[0.08] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.05]'
                              }`}
                            >
                              {c.nameFa}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* City & Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          شهر <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={city}
                          onChange={(e) => handleSelectCity(e.target.value)}
                          className={INPUT_CLASS}
                        >
                          {currentCountryObj.cities
                            .filter((c) => c.id !== 'all')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.fa} ({c.id})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            آدرس یا محله
                          </label>
                          <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                        </div>
                        <input
                          type="text"
                          placeholder="مثال: کیستا، سنتروم یا نام خیابان..."
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchAddressOnMap();
                            }
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    {/* Interactive Map Location Picker */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          موقعیت روی نقشه
                        </label>
                        <span className="text-[10.5px] font-medium text-[#86868B]">
                          تایید موقعیت دقیق
                        </span>
                      </div>
                      <LocationMapPicker
                        lat={mapCoords.lat}
                        lng={mapCoords.lng}
                        zoom={mapZoom}
                        confirmed={mapConfirmed}
                        searching={searchingMap}
                        confirming={confirmingMap}
                        cityLabel={currentCityObj?.fa || city}
                        canSearchAddress={area.trim().length >= 2}
                        onChangeCoords={(nextCoords) => {
                          setMapCoords(nextCoords);
                          if (mapConfirmed) setMapConfirmed(false);
                        }}
                        onChangeZoom={setMapZoom}
                        onSearchAddress={handleSearchAddressOnMap}
                        onConfirm={handleConfirmMapLocation}
                        onUnconfirm={() => setMapConfirmed(false)}
                      />
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 3 — CONTACT (All Optional + Privacy First)
                ====================================================== */}
                {step === 3 && (
                  <div className="space-y-3.5 animate-in fade-in duration-200">
                    {/* Privacy Message */}
                    <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAF2FB]/80 dark:bg-[#0066CC]/15 border border-[#CDE0F5] dark:border-[#0066CC]/30 px-3.5 py-3">
                      <Lock size={15} className="text-[#0066CC] dark:text-[#58A6FF] shrink-0 mt-0.5" />
                      <p className="text-[11.5px] sm:text-xs font-semibold text-[#1D1D1F] dark:text-[#E5E5EA] leading-relaxed">
                        🔒 برای حفظ بیشتر حریم خصوصی، می‌توانید به‌جای شماره تلفن از نام کاربری یا ایمیل استفاده کنید.
                      </p>
                    </div>

                    {/* Telegram Username + Help Popover */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            نام کاربری تلگرام
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenHelp((prev) => (prev === 'telegram' ? null : 'telegram'))
                            }
                            aria-label="راهنمای یافتن نام کاربری تلگرام"
                            aria-expanded={openHelp === 'telegram'}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#86868B] hover:text-[#0066CC] dark:hover:text-[#58A6FF] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                          >
                            <HelpCircle size={13} />
                          </button>
                        </div>
                        <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری • پیشنهادی</span>
                      </div>

                      {openHelp === 'telegram' && (
                        <div className="rounded-xl bg-[#F5F5F7] dark:bg-white/[0.05] border border-[#E5E5EA] dark:border-white/[0.08] px-3 py-2 text-[11px] text-[#515154] dark:text-[#C7C7CC] leading-relaxed animate-in fade-in duration-150">
                          در تلگرام به <strong className="text-[#1D1D1F] dark:text-white">Settings ← Username</strong> بروید و آیدی خود (مثلاً <bdi dir="ltr" className="font-mono">@username</bdi>) را اینجا وارد کنید.
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="@username"
                        value={contactTelegram}
                        onChange={(e) => setContactTelegram(e.target.value)}
                        className={`${INPUT_CLASS} text-left font-mono`}
                        dir="ltr"
                      />
                    </div>

                    {/* WhatsApp Username + Help Popover */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            نام کاربری واتساپ
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenHelp((prev) => (prev === 'whatsapp' ? null : 'whatsapp'))
                            }
                            aria-label="راهنمای یافتن نام کاربری واتساپ"
                            aria-expanded={openHelp === 'whatsapp'}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#86868B] hover:text-[#0066CC] dark:hover:text-[#58A6FF] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                          >
                            <HelpCircle size={13} />
                          </button>
                        </div>
                        <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری • پیشنهادی</span>
                      </div>

                      {openHelp === 'whatsapp' && (
                        <div className="rounded-xl bg-[#F5F5F7] dark:bg-white/[0.05] border border-[#E5E5EA] dark:border-white/[0.08] px-3 py-2 text-[11px] text-[#515154] dark:text-[#C7C7CC] leading-relaxed animate-in fade-in duration-150">
                          در واتساپ به <strong className="text-[#1D1D1F] dark:text-white">Settings ← Profile</strong> بروید و بخش <strong className="text-[#1D1D1F] dark:text-white">Username</strong> (یا لینک <bdi dir="ltr" className="font-mono">wa.me</bdi>) خود را کپی کنید.
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="@username یا +4673..."
                        value={contactWhatsapp}
                        onChange={(e) => setContactWhatsapp(e.target.value)}
                        className={`${INPUT_CLASS} text-left font-mono`}
                        dir="ltr"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          ایمیل
                        </label>
                        <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری • پیشنهادی</span>
                      </div>
                      <input
                        type="email"
                        placeholder="email@example.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className={`${INPUT_CLASS} text-left`}
                        dir="ltr"
                      />
                    </div>

                    {/* Phone & Website (Side-by-side on tablet/desktop, cleanly stacked on mobile) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            شماره تلفن
                          </label>
                          <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                        </div>
                        <input
                          type="tel"
                          placeholder="0731234567"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className={`${INPUT_CLASS} text-left font-mono`}
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            وب‌سایت
                          </label>
                          <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                        </div>
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={contactWebsite}
                          onChange={(e) => setContactWebsite(e.target.value)}
                          className={`${INPUT_CLASS} text-left font-mono`}
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 4 — PUBLISH (Review, Standard/VIP, PIN, Rules)
                ====================================================== */}
                {step === 4 && (
                  <div className="space-y-3.5 animate-in fade-in duration-200">
                    {/* Clean Ad Review Summary Card */}
                    <div className="rounded-2xl border border-[#ECEFF4] dark:border-white/[0.08] bg-white dark:bg-[#121317] divide-y divide-[#F0F2F5] dark:divide-white/[0.06] overflow-hidden">
                      {/* Section 1 Summary: Info */}
                      <div className="p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#86868B]">اطلاعات آگهی</span>
                          <button
                            type="button"
                            onClick={() => goToStep(1)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] dark:text-[#58A6FF] hover:underline cursor-pointer"
                          >
                            <Pencil size={11} />
                            <span>ویرایش</span>
                          </button>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] dark:text-white">
                            {title.trim()}
                          </h4>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[#515154] dark:text-[#A1A1A6]">
                            {currentCategoryObj?.fa || category}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-[#6E6E73] dark:text-[#A1A1A6] line-clamp-2 leading-relaxed">
                          {description.trim()}
                        </p>
                        {(price.trim() || imagesList.length > 0) && (
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            {price.trim() && (
                              <span className="text-[11px] font-extrabold text-[#0066CC] dark:text-[#58A6FF]">
                                قیمت: {price.trim()} {/توافقی/.test(price) ? '' : priceType}
                              </span>
                            )}
                            {imagesList.length > 0 && (
                              <span className="text-[11px] font-semibold text-[#6E6E73] dark:text-[#98989F]">
                                • {imagesList.length.toLocaleString('fa-IR')} تصویر
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Section 2 Summary: Location */}
                      <div className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#86868B]">موقعیت</span>
                          <button
                            type="button"
                            onClick={() => goToStep(2)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] dark:text-[#58A6FF] hover:underline cursor-pointer"
                          >
                            <Pencil size={11} />
                            <span>ویرایش</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            <MapPin size={13} className="text-[#86868B] shrink-0" />
                            <span>
                              {currentCountryObj.nameFa}، {currentCityObj?.fa || city}
                              {area.trim() ? ` — ${area.trim()}` : ''}
                            </span>
                          </span>
                          {mapConfirmed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                              <Check size={10} strokeWidth={3} />
                              <span>نقشه تایید شد</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Section 3 Summary: Contact */}
                      <div className="p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#86868B]">راه‌های تماس</span>
                          <button
                            type="button"
                            onClick={() => goToStep(3)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] dark:text-[#58A6FF] hover:underline cursor-pointer"
                          >
                            <Pencil size={11} />
                            <span>{activeContacts.length > 0 ? 'ویرایش' : 'افزودن'}</span>
                          </button>
                        </div>
                        {activeContacts.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {activeContacts.map((item) => {
                              const CIcon = item.Icon;
                              return (
                                <span
                                  key={item.label}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[11px] font-semibold text-[#1D1D1F] dark:text-[#E5E5EA]"
                                >
                                  <CIcon size={11} className="text-[#86868B] shrink-0" />
                                  <span>{item.label}:</span>
                                  <bdi dir="ltr" className="font-mono text-[10.5px] truncate max-w-[130px]">
                                    {item.value}
                                  </bdi>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#86868B]">
                            بدون راه تماس (اختیاری)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Choose Standard vs VIP Listing */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWantVipPromotion(false)}
                        className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                          !wantVipPromotion
                            ? 'bg-[#EAF2FB]/80 dark:bg-[#0066CC]/15 border-[#0066CC] ring-1 ring-[#0066CC]'
                            : 'bg-white dark:bg-[#121317] border-[#E5E5EA] dark:border-white/[0.08] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-extrabold text-[#1D1D1F] dark:text-white">
                            آگهی عادی
                          </span>
                          <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                            رایگان
                          </span>
                        </div>
                        <span className="block text-[10.5px] text-[#6E6E73] dark:text-[#98989F]">
                          انتشار استاندارد در فهرست
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWantVipPromotion(true)}
                        className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                          wantVipPromotion
                            ? 'bg-[#EAF2FB]/80 dark:bg-[#0066CC]/15 border-[#0066CC] ring-1 ring-[#0066CC]'
                            : 'bg-white dark:bg-[#121317] border-[#E5E5EA] dark:border-white/[0.08] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#1D1D1F] dark:text-white">
                            <Crown size={12} className="text-[#0066CC] dark:text-[#58A6FF]" />
                            <span>ویژه (VIP)</span>
                          </span>
                          <span className="text-[11px] font-extrabold text-[#0066CC] dark:text-[#58A6FF]">
                            {vipPriceLabel}
                          </span>
                        </div>
                        <span className="block text-[10.5px] text-[#6E6E73] dark:text-[#98989F]">
                          نمایش در صدر {currentCountryObj.nameFa}
                        </span>
                      </button>
                    </div>

                    {/* Set / Confirm Management Code (PIN) */}
                    <div className="rounded-2xl border border-[#ECEFF4] dark:border-white/[0.08] bg-[#F5F5F7]/70 dark:bg-white/[0.03] p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <KeyRound size={14} className="text-[#0066CC] dark:text-[#58A6FF] shrink-0" />
                          <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            کد مدیریت آگهی (برای ویرایش یا حذف)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setManagePin(generateClientPin())}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                          title="تولید کد جدید"
                        >
                          <RefreshCw size={11} />
                          <span>کد جدید</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          maxLength={12}
                          value={managePin}
                          onChange={(e) => setManagePin(e.target.value)}
                          placeholder="۶ تا ۱۲ رقم یا حرف"
                          aria-label="کد مدیریت آگهی"
                          className={`flex-1 h-10 rounded-xl border bg-white dark:bg-[#121317] px-3 text-center font-mono text-sm font-black tracking-widest focus:outline-none ${
                            isPinValid
                              ? 'border-[#E5E5EA] dark:border-white/[0.1] text-[#1D1D1F] dark:text-white focus:border-[#0066CC]'
                              : 'border-rose-400 text-rose-600 dark:text-rose-400'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(cleanPinCandidate, 'previewPin')}
                          className="h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] border border-[#E5E5EA] dark:border-white/[0.1] text-xs font-bold text-[#1D1D1F] dark:text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 transition-all"
                        >
                          {pinCopiedPreview ? (
                            <Check size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                          <span>{pinCopiedPreview ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                      {!isPinValid && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          کد مدیریت باید بین ۶ تا ۱۲ عدد یا حرف انگلیسی باشد.
                        </p>
                      )}
                    </div>

                    {/* Accept Publishing Rules */}
                    <div className="rounded-2xl border border-[#ECEFF4] dark:border-white/[0.08] bg-white dark:bg-[#121317] p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0">
                          <input
                            type="checkbox"
                            checked={rulesAccepted}
                            onChange={(e) => {
                              setRulesAccepted(e.target.checked);
                              if (e.target.checked) setErrorMsg('');
                            }}
                            className="h-4 w-4 rounded accent-[#0066CC] cursor-pointer shrink-0"
                          />
                          <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            قوانین انتشار آگهی را می‌پذیرم <span className="text-rose-500">*</span>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowRulesDetails((v) => !v)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] dark:text-[#58A6FF] shrink-0 cursor-pointer"
                        >
                          <ShieldCheck size={12} />
                          <span>{showRulesDetails ? 'بستن' : 'مشاهده'}</span>
                        </button>
                      </div>

                      {showRulesDetails && (
                        <ul className="pt-2 border-t border-[#F0F2F5] dark:border-white/[0.06] space-y-1 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed list-disc ps-4">
                          {policyRules.map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Cloudflare Turnstile */}
                    {turnstileSettings.enabled !== false &&
                      turnstileSettings.protectPostAd !== false && (
                        <div className="pt-1 flex justify-center">
                          <CloudflareTurnstile
                            theme="auto"
                            mode={turnstileSettings.mode}
                            siteKey={turnstileSettings.siteKey}
                            onVerify={(token) => {
                              setTurnstileToken(token);
                              setErrorMsg('');
                            }}
                            onExpire={() => setTurnstileToken('')}
                          />
                        </div>
                      )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky Bottom Action Bar */}
          {!successData && (
            <div className="px-4 sm:px-6 py-3.5 bg-[#FBFBFC] dark:bg-[#171920] border-t border-[#ECEFF4] dark:border-white/[0.06] flex items-center gap-2.5 shrink-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="h-11 px-4 sm:px-5 rounded-full border border-[#E5E5EA] dark:border-white/[0.1] bg-[#F5F5F7] hover:bg-[#ECECEF] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-[#1D1D1F] dark:text-[#F5F5F7] font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.95] cursor-pointer shrink-0"
                >
                  <ChevronRight size={16} />
                  <span>قبلی</span>
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  disabled={step === 1 && descriptionHasLink}
                  onClick={handleNextStep}
                  className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.97] cursor-pointer"
                >
                  <span>
                    {step === 1
                      ? 'ادامه: موقعیت'
                      : step === 2
                        ? 'ادامه: اطلاعات تماس'
                        : 'ادامه: بررسی و انتشار'}
                  </span>
                  <ChevronLeft size={17} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || descriptionHasLink || !rulesAccepted || !isPinValid}
                  className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.97] cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <PlusCircle size={16} />
                  )}
                  <span>
                    {loading
                      ? 'در حال انتشار...'
                      : wantVipPromotion
                        ? `انتشار و پرداخت ویژه (${vipPriceLabel})`
                        : 'انتشار رایگان آگهی'}
                  </span>
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
