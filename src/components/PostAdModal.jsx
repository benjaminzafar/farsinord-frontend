import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Search,
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
  Home,
  Utensils,
  Briefcase,
  GraduationCap,
  ShoppingBag,
  Car,
  Laptop,
  Calendar,
  Tag,
} from 'lucide-react';
import CloudflareTurnstile from './CloudflareTurnstile';
import LocationMapPicker from './LocationMapPicker';
import { getCityDefaultCoords, hasCityDefaultCoords } from '../lib/cityCoords';
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

function isValidWebsiteInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isSafeHttpUrl(normalized)) return false;
  try {
    const u = new URL(normalized);
    return Boolean(u.hostname && u.hostname.includes('.') && !u.hostname.startsWith('.') && !u.hostname.endsWith('.'));
  } catch {
    return false;
  }
}

function isValidTelegramInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  const handle = trimmed
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, '')
    .split(/[?#]/)[0]
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return handle.length >= 3;
}

function isValidWhatsAppInput(raw) {
  const trimmed = normalizeAsciiDigits(raw).trim();
  if (!trimmed) return true;
  const base = trimmed
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/i, '')
    .split(/[?#]/)[0]
    .replace(/^@+/, '');
  const digits = base.replace(/\D/g, '');
  const handle = base.replace(/[^a-zA-Z0-9._-]/g, '');
  return digits.length >= 6 || (/[a-zA-Z]/.test(handle) && handle.length >= 3);
}

const MAX_PHOTOS = 4;
const MAX_FILE_BYTES = MAX_IMAGE_BYTES;

const CATEGORY_ICONS = {
  bostad: Home,
  restaurang: Utensils,
  tjanster: Briefcase,
  jobb: GraduationCap,
  'kop-salj': ShoppingBag,
  fordon: Car,
  elektronik: Laptop,
  evenemang: Calendar,
  ovrigt: Tag,
};

const COUNTRY_PHONE_PLACEHOLDERS = {
  se: '+46 70 123 45 67',
  no: '+47 90 12 34 56',
  dk: '+45 20 12 34 56',
  fi: '+358 40 123 4567',
  de: '+49 170 1234567',
  at: '+43 660 1234567',
  nl: '+31 6 12345678',
  fr: '+33 6 12 34 56 78',
};

const WIZARD_STEPS = [
  { num: 1, label: 'اطلاعات', subtitle: 'اطلاعات اصلی و دسته‌بندی آگهی' },
  { num: 2, label: 'موقعیت', subtitle: 'انتخاب کشور، شهر و محدوده' },
  { num: 3, label: 'تماس', subtitle: 'حداقل ۱ روش تماس (بدون نیاز به تلفن)' },
  { num: 4, label: 'انتشار', subtitle: 'بازبینی نهایی و ثبت آگهی' },
];

const INPUT_CLASS =
  'w-full h-11 rounded-xl border border-[#ECEFF4] dark:border-white/[0.1] bg-[#FFFFFF] dark:!bg-[#111318] px-3.5 text-xs sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#6E6E73] focus:border-[#0066CC] dark:focus:border-[#388BFD] focus:ring-2 focus:ring-[#0066CC]/15 focus:outline-none transition-colors';

export default function PostAdModal({
  initialCategory = 'bostad',
  selectedCountry = 'se',
  countries = COUNTRIES,
  lifecycleSettings = null,
  turnstileSettings: propTurnstileSettings = null,
  stripeSettings = null,
  onClose,
  onCreated,
  onOpenManageExisting,
  onProceedToVip,
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
  const cityDropdownRef = useRef(null);
  const citySearchInputRef = useRef(null);
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
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [priceType, setPriceType] = useState(initialCountryObj.currency || 'kr');
  const [imageUrl, setImageUrl] = useState('');
  const [imagesList, setImagesList] = useState([]);
  const [imageHashes, setImageHashes] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  // Step 2 — Location & Map
  const [adCountry, setAdCountry] = useState(initialCountryId);
  const [city, setCity] = useState(initialCityId);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [area, setArea] = useState('');
  const [mapCoords, setMapCoords] = useState(() =>
    getCityDefaultCoords(initialCityId, initialCountryId)
  );
  const [mapZoom, setMapZoom] = useState(13);
  const [mapConfirmed, setMapConfirmed] = useState(false);
  const [resolvedMapArea, setResolvedMapArea] = useState('');
  const [mapNotice, setMapNotice] = useState('');
  const [searchingMap, setSearchingMap] = useState(false);
  const [confirmingMap, setConfirmingMap] = useState(false);

  // Step 3 — Contact (at least 1 required; phone optional)
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [openHelp, setOpenHelp] = useState(null); // null | 'telegram' | 'whatsapp'
  const [contactHighlightError, setContactHighlightError] = useState(false);

  // Step 4 — Publish
  const vipEnabled = stripeSettings?.enabled !== false;
  const [wantVipPromotion, setWantVipPromotion] = useState(false);
  const [managePin, setManagePin] = useState(() => generateClientPin());
  const [pinCopiedPreview, setPinCopiedPreview] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesHighlightError, setRulesHighlightError] = useState(false);
  const [showRulesDetails, setShowRulesDetails] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
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
  const countryCities = useMemo(
    () => (currentCountryObj?.cities || []).filter((c) => c.id !== 'all'),
    [currentCountryObj]
  );
  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return countryCities;
    return countryCities.filter(
      (c) =>
        (c.fa && c.fa.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q))
    );
  }, [countryCities, cityQuery]);
  const currentCityObj = countryCities.find((c) => c.id === city);
  const currentCategoryObj = CATEGORIES.find((c) => c.id === category);
  const descriptionHasLink = containsLinkInDescription(description);
  const cleanPinCandidate = normalizeAsciiDigits(managePin).trim();
  const isPinValid = /^[0-9A-Za-z]{6,12}$/.test(cleanPinCandidate);
  const phonePlaceholder = COUNTRY_PHONE_PLACEHOLDERS[adCountry] || '+46 70 123 45 67';

  const scrollBodyTop = () => {
    try {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    scrollBodyTop();
  };

  // Lock background page scroll while modal is open & handle Escape key cleanly
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (cityDropdownOpen) {
        setCityDropdownOpen(false);
        setCityQuery('');
        return;
      }
      if (openHelp) {
        setOpenHelp(null);
        return;
      }
      onClose?.();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [cityDropdownOpen, openHelp, onClose]);

  // Click outside city combobox
  useEffect(() => {
    if (!cityDropdownOpen) return undefined;
    const handleOutside = (e) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target)) {
        setCityDropdownOpen(false);
        setCityQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [cityDropdownOpen]);

  // Reset Turnstile token whenever leaving Step 4 so tokens never go stale
  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((k) => k + 1);
  };

  // Country & City selection updates map center (geocoding custom cities automatically)
  const handleSelectCountry = (c) => {
    setAdCountry(c.id);
    const firstCity = c.cities.find((ct) => ct.id !== 'all')?.id || '';
    setCity(firstCity);
    setPriceType(c.currency || 'kr');
    setMapCoords(getCityDefaultCoords(firstCity, c.id));
    setMapZoom(12);
    setMapConfirmed(false);
    setResolvedMapArea('');
    setMapNotice('');
    setCityDropdownOpen(false);
    setCityQuery('');
  };

  const handleSelectCity = async (nextCity) => {
    setCity(nextCity);
    setCityDropdownOpen(false);
    setCityQuery('');
    setMapConfirmed(false);
    setResolvedMapArea('');
    setMapNotice('');

    if (hasCityDefaultCoords(nextCity)) {
      setMapCoords(getCityDefaultCoords(nextCity, adCountry));
      setMapZoom(13);
      return;
    }

    setMapCoords(getCityDefaultCoords(nextCity, adCountry));
    setMapZoom(12);
    const hit = await publicApi.geocodeLocation({ q: nextCity, country: adCountry });
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
      setMapCoords({ lat: hit.lat, lng: hit.lng });
      setMapZoom(13);
    }
  };

  const handleSearchAddressOnMap = async () => {
    const queryParts = [area.trim(), city].filter(Boolean).join(', ');
    if (queryParts.length < 2) return;
    setMapNotice('');
    setSearchingMap(true);
    try {
      const res = await publicApi.geocodeLocation({ q: queryParts, country: adCountry });
      if (res && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
        setMapCoords({ lat: res.lat, lng: res.lng });
        setMapZoom(15);
        setMapConfirmed(false);
        setResolvedMapArea('');
      } else {
        setMapNotice('آدرس دقیق روی نقشه یافت نشد؛ می‌توانید پین را دستی جابه‌جا کنید.');
      }
    } finally {
      setSearchingMap(false);
    }
  };

  const handleConfirmMapLocation = async () => {
    setMapNotice('');
    setConfirmingMap(true);
    try {
      const label = await publicApi.reverseGeocodeLocation({
        lat: mapCoords.lat,
        lng: mapCoords.lng,
      });
      if (label) {
        setArea(label);
        setResolvedMapArea(label);
        setMapConfirmed(true);
      } else if (area.trim()) {
        setResolvedMapArea(area.trim());
        setMapConfirmed(true);
      } else {
        setMapConfirmed(false);
        setMapNotice('نام محله به‌صورت خودکار یافت نشد؛ لطفاً محله را در کادر بالا وارد کنید.');
      }
    } finally {
      setConfirmingMap(false);
    }
  };

  // Photo upload helpers
  const addImage = () => {
    setErrorMsg('');
    if (imagesList.length >= MAX_PHOTOS) {
      showError('حداکثر ۴ عکس می‌توانید برای هر آگهی اضافه کنید.');
      return;
    }
    const trimmed = imageUrl.trim();
    if (trimmed) {
      if (!isSafeHttpUrl(trimmed)) {
        showError('لطفاً لینک عکس معتبر (با https://) وارد کنید.');
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
      showError('حداکثر ۴ عکس می‌توانید برای هر آگهی اضافه کنید.');
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      showError(`فقط ${remainingSlots.toLocaleString('fa-IR')} عکس دیگر می‌توانید اضافه کنید (حداکثر ۴ عکس).`);
    }

    setUploadingPhotos(true);
    try {
      const results = await Promise.all(
        filesToUpload.map(async (rawFile) => {
          if (!rawFile.type.startsWith('image/')) {
            throw new Error('فقط فایل‌های تصویری (JPG، PNG، WebP) مجاز هستند.');
          }
          const readyFile = await compressImageForUpload(rawFile, { maxBytes: MAX_FILE_BYTES });
          if (readyFile.size > MAX_FILE_BYTES) {
            throw new Error('حجم هر عکس باید حداکثر ۱ مگابایت باشد.');
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
            throw new Error('ارسال عکس با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
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
      showError(err.message || 'بارگذاری عکس انجام نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removeImage = (index) => {
    setImagesList(imagesList.filter((_, i) => i !== index));
    setImageHashes(imageHashes.filter((_, i) => i !== index));
  };

  const activeContacts = [
    contactTelegram.trim() && { label: 'تلگرام', value: contactTelegram.trim(), Icon: Send },
    contactEmail.trim() && { label: 'ایمیل', value: contactEmail.trim(), Icon: Mail },
    contactWhatsapp.trim() && { label: 'واتساپ', value: contactWhatsapp.trim(), Icon: MessageCircle },
    contactPhone.trim() && { label: 'تلفن', value: contactPhone.trim(), Icon: Phone },
    contactWebsite.trim() && { label: 'وب‌سایت', value: contactWebsite.trim(), Icon: Globe },
  ].filter(Boolean);

  // Parsed price preview aligned strictly with what gets submitted
  const parsedPricePreview = useMemo(() => {
    if (priceNegotiable) return 'توافقی';
    const rawTrimmed = String(price || '').trim();
    if (!rawTrimmed) return '';
    if (/توافقی/.test(rawTrimmed)) return 'توافقی';
    const num = parseFloat(normalizeAsciiDigits(rawTrimmed).replace(/,/g, ''));
    if (!Number.isFinite(num) || num <= 0) return '';
    const unitLabel = !priceType || priceType === 'kr' ? 'کرون' : priceType === '€' ? 'یورو' : priceType;
    return `${num.toLocaleString('fa-IR')} ${unitLabel}`;
  }, [price, priceNegotiable, priceType]);

  const validateContacts = () => {
    if (activeContacts.length === 0) {
      setContactHighlightError(true);
      showError('لطفاً حداقل یک روش تماس (تلگرام، ایمیل، واتساپ، شماره تلفن یا وب‌سایت) وارد کنید.');
      return false;
    }
    if (contactTelegram.trim() && !isValidTelegramInput(contactTelegram)) {
      showError('نام کاربری تلگرام واردشده معتبر نیست (حداقل ۳ کاراکتر انگلیسی).');
      return false;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      showError('آدرس ایمیل واردشده معتبر نیست.');
      return false;
    }
    if (contactWhatsapp.trim() && !isValidWhatsAppInput(contactWhatsapp)) {
      showError('نام کاربری یا شماره واتساپ واردشده معتبر نیست.');
      return false;
    }
    if (contactPhone.trim() && normalizeAsciiDigits(contactPhone).replace(/\D/g, '').length < 6) {
      showError('شماره تلفن واردشده معتبر نیست.');
      return false;
    }
    if (contactWebsite.trim() && !isValidWebsiteInput(contactWebsite)) {
      showError('آدرس وب‌سایت واردشده معتبر نیست.');
      return false;
    }
    setContactHighlightError(false);
    return true;
  };

  const goToStep = (targetStep) => {
    setErrorMsg('');
    setOpenHelp(null);
    setCityDropdownOpen(false);
    if (step === 4 && targetStep !== 4) {
      resetTurnstile();
      setDuplicateWarning(null);
    }
    setStep(targetStep);
    scrollBodyTop();
  };

  const handleNextStep = () => {
    setErrorMsg('');
    setOpenHelp(null);
    setCityDropdownOpen(false);

    if (step === 1) {
      if (uploadingPhotos) {
        showError('لطفاً تا پایان بارگذاری عکس صبر کنید.');
        return;
      }
      if (!title.trim() || !category || !description.trim()) {
        showError('لطفاً عنوان، دسته‌بندی و توضیحات آگهی را وارد کنید.');
        return;
      }
      if (containsLinkInDescription(description)) {
        showError(DESCRIPTION_LINK_ERROR_MSG);
        return;
      }
      const modCheck = checkProhibitedContent({ title, description });
      if (modCheck.blocked) {
        showError(modCheck.reason);
        return;
      }
      setStep(2);
      scrollBodyTop();
      return;
    }

    if (step === 2) {
      if (!adCountry || !city) {
        showError('لطفاً کشور و شهر محل آگهی را انتخاب کنید.');
        return;
      }
      setStep(3);
      scrollBodyTop();
      return;
    }

    if (step === 3) {
      if (!validateContacts()) return;
      setStep(4);
      scrollBodyTop();
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setOpenHelp(null);
    setCityDropdownOpen(false);
    if (step === 4) {
      resetTurnstile();
      setDuplicateWarning(null);
    }
    if (step > 1) {
      setStep(step - 1);
      scrollBodyTop();
    }
  };

  const submitAd = async ({ requestDuplicateReview = false } = {}) => {
    setErrorMsg('');
    if (!requestDuplicateReview) setDuplicateWarning(null);

    if (!title.trim() || !description.trim()) {
      setStep(1);
      showError('لطفاً عنوان و توضیحات آگهی را وارد کنید.');
      return;
    }

    if (containsLinkInDescription(description)) {
      setStep(1);
      showError(DESCRIPTION_LINK_ERROR_MSG);
      return;
    }

    if (!validateContacts()) {
      setStep(3);
      return;
    }

    if (!isPinValid) {
      showError('کد مدیریت باید ۶ تا ۱۲ رقم یا حرف انگلیسی باشد.');
      return;
    }

    if (!rulesAccepted) {
      setRulesHighlightError(true);
      showError('لطفاً قوانین انتشار آگهی را تایید کنید.');
      return;
    }
    setRulesHighlightError(false);

    const modCheck = checkProhibitedContent({ title, description, area });
    if (modCheck.blocked) {
      showError(modCheck.reason);
      return;
    }

    const turnstileRequired =
      turnstileSettings.enabled !== false && turnstileSettings.protectPostAd !== false;
    if (turnstileRequired && !turnstileToken) {
      showError('لطفاً تایید امنیتی را تکمیل کنید.');
      return;
    }

    setLoading(true);

    try {
      const allImages = imagesList.filter(isSafeHttpUrl).slice(0, MAX_PHOTOS);
      if (allImages.length < MAX_PHOTOS && imageUrl.trim() && isSafeHttpUrl(imageUrl.trim())) {
        allImages.push(imageUrl.trim());
      }

      const rawPriceTrimmed = String(price || '').trim();
      const userTypedTavafoghi =
        priceNegotiable || /توافقی/.test(rawPriceTrimmed) || /توافقی/.test(String(priceType || ''));
      const normalizedPriceDigits = normalizeAsciiDigits(rawPriceTrimmed).replace(/,/g, '');
      const parsedNumPrice = parseFloat(normalizedPriceDigits);
      const hasValidNumPrice = !priceNegotiable && Number.isFinite(parsedNumPrice) && parsedNumPrice > 0;

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
        contact_phone: contactPhone.trim() ? normalizeAsciiDigits(contactPhone).trim() : null,
        contact_whatsapp: contactWhatsapp.trim() ? normalizeAsciiDigits(contactWhatsapp).trim() : null,
        contact_telegram: contactTelegram.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_website: normalizedWebsite && isValidWebsiteInput(normalizedWebsite) ? normalizedWebsite : null,
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
        wantVip: Boolean(wantVipPromotion && vipEnabled),
      });

      if (onCreated) {
        onCreated(res.ad, Boolean(wantVipPromotion && vipEnabled));
      }
    } catch (err) {
      console.error('Error posting ad:', err);
      // Single-use Turnstile token was consumed; reset widget so user can retry or request review cleanly
      resetTurnstile();
      if (err.code === 'DUPLICATE_AD' && err.duplicateMatch) {
        setDuplicateWarning({
          ...err.duplicateMatch,
          reasons: err.reasons || [],
          message: err.message,
        });
        scrollBodyTop();
      } else {
        showError(err.message || 'ثبت آگهی انجام نشد. لطفاً دوباره تلاش کنید.');
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

  const copyToClipboard = async (text, type) => {
    if (!text || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
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
    } catch {}
  };

  const dynamicVipAmount =
    currentCountryObj.currency === '€'
      ? Number(stripeSettings?.vipPriceEur || 9)
      : Number(stripeSettings?.vipPrice || 99);
  const vipPriceLabel =
    currentCountryObj.currency === '€'
      ? `${dynamicVipAmount.toLocaleString('fa-IR')} یورو`
      : `${dynamicVipAmount.toLocaleString('fa-IR')} کرون`;

  const activeStepMeta = WIZARD_STEPS[step - 1] || WIZARD_STEPS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazir"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1D1D1F]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Centered Modal Box (Mobile & Desktop) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-ad-modal-title"
        className="relative w-full max-w-xl bg-[#FBFBFC] dark:!bg-[#171920] rounded-[24px] sm:rounded-3xl shadow-[0_24px_70px_rgba(29,29,31,0.24)] border border-[#ECEFF4] dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[92dvh] z-10 transition-all duration-150"
      >
        {/* Clean Compact Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-[#ECEFF4] dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] shrink-0">
              <PlusCircle size={19} strokeWidth={2} className="block shrink-0" />
            </div>
            <div className="min-w-0">
              <h2
                id="post-ad-modal-title"
                className="text-sm sm:text-base font-extrabold text-[#1D1D1F] dark:text-white leading-tight truncate"
              >
                {currentT.postAdBtn}
              </h2>
              <span className="block text-[11px] font-medium text-[#6E6E73] dark:text-[#98989F] truncate">
                {successData ? 'آگهی با موفقیت ثبت شد' : activeStepMeta.subtitle}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <X size={18} className="block shrink-0" />
          </button>
        </div>

        {/* Connected 4-Step Progress Indicator: 1 اطلاعات → 2 موقعیت → 3 تماس → 4 انتشار */}
        {!successData && (
          <div className="px-4 sm:px-6 py-3 bg-[#FBFBFC] dark:!bg-[#171920] border-b border-[#ECEFF4] dark:border-white/[0.06] shrink-0">
            <div className="relative grid grid-cols-4">
              {/* Connecting Track Rail (RTL: anchored on right at 12.5%, spans 75%) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-3.5 inset-x-[12.5%] h-[2px] rounded-full bg-[#ECEFF4] dark:bg-white/[0.08] overflow-hidden"
              >
                <div
                  className="h-full bg-[#0066CC] transition-all duration-300 ease-out ms-auto"
                  style={{ width: `${((step - 1) / 3) * 100}%` }}
                />
              </div>

              {WIZARD_STEPS.map((s) => {
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={s.num > step}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => {
                      if (s.num < step) goToStep(s.num);
                    }}
                    className={`relative z-10 flex flex-col items-center gap-1.5 group ${
                      isDone ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black leading-none transition-all duration-200 ${
                        isCurrent
                          ? 'bg-[#0066CC] text-white ring-4 ring-[#0066CC]/15'
                          : isDone
                            ? 'bg-[#0066CC] text-white group-hover:scale-105'
                            : 'bg-[#FFFFFF] dark:!bg-[#1C1F28] border border-[#D2D2D7] dark:border-white/[0.12] text-[#86868B]'
                      }`}
                    >
                      {isDone ? (
                        <Check size={13} strokeWidth={3} className="block shrink-0" />
                      ) : (
                        <span className="leading-none">{s.num.toLocaleString('fa-IR')}</span>
                      )}
                    </span>
                    <span
                      className={`text-[11px] leading-none transition-colors ${
                        isCurrent
                          ? 'font-extrabold text-[#0066CC] dark:text-[#58A6FF]'
                          : isDone
                            ? 'font-bold text-[#1D1D1F] dark:text-[#E5E5EA]'
                            : 'font-medium text-[#86868B] dark:text-[#6E6E73]'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <form
          id="post-ad-wizard-form"
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            ref={bodyScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 custom-scrollbar space-y-4"
          >
            {successData ? (
              /* SUCCESS SCREEN */
              <div className="py-4 text-center space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check size={28} strokeWidth={2.5} className="block shrink-0" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1D1D1F] dark:text-white">
                    {successData.ad?.status === 'active'
                      ? 'آگهی شما با موفقیت منتشر شد'
                      : 'آگهی شما ثبت شد و پس از بررسی منتشر می‌شود'}
                  </h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] max-w-sm mx-auto leading-relaxed">
                    {successData.duplicateReviewFlagged
                      ? 'آگهی شما برای بررسی به مدیر ارسال شد و پس از تایید منتشر می‌شود.'
                      : currentT.saveYourCredentials}
                  </p>
                </div>

                <div className="max-w-md mx-auto rounded-2xl bg-[#F5F5F7] dark:!bg-[#111318] border border-[#ECEFF4] dark:border-white/[0.08] divide-y divide-[#ECEFF4] dark:divide-white/[0.06] overflow-hidden text-right">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10px] font-bold text-[#86868B]">
                        {currentT.referenceNo}
                      </span>
                      <span className="font-mono text-base font-black text-[#1D1D1F] dark:text-white">
                        <bdi dir="ltr">{successData.referenceNumber}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.referenceNumber, 'ref')}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#FFFFFF] dark:!bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white text-xs font-semibold leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedRef ? (
                        <Check size={13} className="block shrink-0 text-emerald-500" />
                      ) : (
                        <Copy size={13} className="block shrink-0" />
                      )}
                      <span className="leading-none">{copiedRef ? currentT.copied : currentT.copyRef}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10px] font-bold text-[#86868B]">
                        {currentT.pinCode}
                      </span>
                      <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400">
                        <bdi dir="ltr">{successData.pinCode}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.pinCode, 'pin')}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#FFFFFF] dark:!bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white text-xs font-semibold leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedPin ? (
                        <Check size={13} className="block shrink-0 text-emerald-500" />
                      ) : (
                        <Copy size={13} className="block shrink-0" />
                      )}
                      <span className="leading-none">{copiedPin ? currentT.copied : currentT.copyPin}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] px-4 py-3 leading-relaxed">
                    <KeyRound size={14} className="block shrink-0 text-[#86868B]" />
                    <span>این کدها در همین مرورگر ذخیره شدند؛ برای مدیریت از دستگاه دیگر، آن‌ها را کپی کنید.</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2.5 flex-wrap">
                  {successData.wantVip && onProceedToVip && (
                    <button
                      type="button"
                      onClick={() => onProceedToVip(successData.ad)}
                      className="h-10 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-white font-bold text-xs inline-flex items-center gap-1.5 leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      <Crown size={14} className="block shrink-0" />
                      <span className="leading-none">ادامه و پرداخت آگهی ویژه ({vipPriceLabel})</span>
                    </button>
                  )}

                  {onOpenManageExisting && !successData.wantVip && (
                    <button
                      type="button"
                      onClick={() => onOpenManageExisting(successData.referenceNumber)}
                      className="h-10 px-5 rounded-full bg-[#F5F5F7] dark:!bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white font-bold text-xs inline-flex items-center gap-1.5 leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      <KeyRound size={14} className="block shrink-0" />
                      <span className="leading-none">مدیریت آگهی</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className={`h-10 px-6 rounded-full font-bold text-xs leading-none active:scale-95 transition-all cursor-pointer ${
                      successData.wantVip
                        ? 'bg-[#F5F5F7] dark:!bg-white/[0.08] text-[#1D1D1F] dark:text-white hover:bg-[#ECECEF]'
                        : 'bg-[#0066CC] hover:bg-[#0055AA] text-white'
                    }`}
                  >
                    {currentT.close}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Error Alert */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300 font-semibold"
                  >
                    <AlertCircle size={15} className="block shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Duplicate Ad Warning */}
                {duplicateWarning && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-300 dark:border-amber-500/35 bg-amber-50/90 dark:bg-amber-500/10 p-4 space-y-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <CopyCheck size={18} className="block text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-[13px] font-black text-amber-950 dark:text-amber-200">
                            آگهی مشابه یا تکراری شناسایی شد
                          </h4>
                          {Number(duplicateWarning.score) > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-500/25 text-amber-950 dark:text-amber-200 text-[10.5px] font-extrabold tabular-nums">
                              تشابه {Math.round(duplicateWarning.score * 100).toLocaleString('fa-IR')}٪
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-amber-900 dark:text-amber-300/90 leading-relaxed">
                          {duplicateWarning.message}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#FFFFFF] dark:!bg-[#111318] border border-amber-200/80 dark:border-white/[0.08] p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-[#1D1D1F] dark:text-white truncate">
                          {duplicateWarning.title}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#0066CC] dark:text-[#58A6FF] bg-blue-50 dark:bg-[#0066CC]/15 px-2 py-0.5 rounded-md">
                          <bdi dir="ltr">{duplicateWarning.reference_number}</bdi>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] dark:text-[#98989F]">
                        <span>{duplicateWarning.city}</span>
                        <span>•</span>
                        <span>{duplicateWarning.status === 'active' ? 'منتشرشده' : 'در انتظار تایید'}</span>
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
                        className="flex-1 h-9 px-3 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold leading-none flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Sparkles size={13} className="block shrink-0" />
                        <span className="leading-none">ویرایش یا بوست رایگان آگهی قبلی</span>
                      </button>
                      {duplicateWarning.status === 'active' && (
                        <a
                          href={`/?ad=${encodeURIComponent(duplicateWarning.reference_number)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3 rounded-xl bg-[#FFFFFF] dark:!bg-white/[0.06] border border-amber-300 dark:border-amber-500/30 hover:bg-amber-100/60 text-amber-950 dark:text-amber-200 text-xs font-bold leading-none flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink size={13} className="block shrink-0" />
                          <span className="leading-none">مشاهده آگهی</span>
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => submitAd({ requestDuplicateReview: true })}
                      className="w-full py-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 hover:underline cursor-pointer text-center"
                    >
                      این آگهی متفاوت است — ارسال برای بررسی مدیر
                    </button>
                  </div>
                )}

                {/* ======================================================
                    STEP 1 — INFORMATION (Clean & Minimal)
                ====================================================== */}
                {step === 1 && (
                  <div className="space-y-4">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="post-ad-title"
                          className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                        >
                          عنوان آگهی <span className="text-rose-500">*</span>
                        </label>
                        {title.length > 65 && (
                          <span className="text-[10.5px] font-semibold text-[#86868B] tabular-nums">
                            {title.length.toLocaleString('fa-IR')} / ۱۰۰
                          </span>
                        )}
                      </div>
                      <input
                        id="post-ad-title"
                        type="text"
                        maxLength={100}
                        placeholder="مثال: اجاره آپارتمان ۲ خوابه در استکهلم"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    {/* Category Icon Capsule Pills (Replaces raw native <select>) */}
                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        دسته‌بندی <span className="text-rose-500">*</span>
                      </span>
                      <div
                        role="radiogroup"
                        aria-label="دسته‌بندی آگهی"
                        className="flex flex-wrap gap-1.5"
                      >
                        {CATEGORIES.filter((c) => c.id !== 'all').map((c) => {
                          const isSelected = category === c.id;
                          const CatIcon = CATEGORY_ICONS[c.id] || Tag;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setCategory(c.id)}
                              className={`h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-bold leading-none border transition-all duration-150 active:scale-[0.96] cursor-pointer ${
                                isSelected
                                  ? 'bg-[#0066CC] text-white border-[#0066CC] shadow-xs'
                                  : 'bg-[#FFFFFF] dark:!bg-[#111318] text-[#515154] dark:text-[#C7C7CC] border-[#ECEFF4] dark:border-white/[0.08] hover:border-[#0066CC]/45 hover:text-[#1D1D1F] dark:hover:text-white'
                              }`}
                            >
                              <CatIcon
                                size={13}
                                strokeWidth={2}
                                className={`block shrink-0 ${
                                  isSelected ? 'text-white' : 'text-[#86868B] dark:text-[#98989F]'
                                }`}
                              />
                              <span className="leading-none">{c.fa}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Short Description */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="post-ad-desc"
                          className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                        >
                          توضیحات آگهی <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10.5px] font-medium text-[#86868B]">
                          بدون درج لینک
                        </span>
                      </div>
                      <textarea
                        id="post-ad-desc"
                        rows={3}
                        placeholder="مشخصات اصلی، شرایط یا ساعات کاری را شفاف بنویسید..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full rounded-xl border bg-[#FFFFFF] dark:!bg-[#111318] p-3.5 text-xs sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 leading-relaxed transition-colors ${
                          descriptionHasLink
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-[#ECEFF4] dark:border-white/[0.1] focus:border-[#0066CC] dark:focus:border-[#388BFD] focus:ring-[#0066CC]/15'
                        }`}
                      />
                      {descriptionHasLink && (
                        <p role="alert" className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          {DESCRIPTION_LINK_ERROR_MSG}
                        </p>
                      )}
                    </div>

                    {/* Compact Optional Drawer: Price & Photos */}
                    <div
                      className={`rounded-2xl border overflow-hidden transition-colors ${
                        showExtras || imagesList.length > 0 || parsedPricePreview
                          ? 'border-[#ECEFF4] dark:border-white/[0.1] bg-[#F5F5F7]/75 dark:!bg-white/[0.03]'
                          : 'border-dashed border-[#ECEFF4] dark:border-white/[0.12] hover:border-[#0066CC]/45 bg-[#FFFFFF] dark:!bg-[#111318]/65'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setShowExtras((v) => !v)}
                        className="w-full flex items-center justify-between px-3.5 py-3 text-right cursor-pointer hover:bg-[#F5F5F7]/70 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <ImageIcon size={15} className="block shrink-0 text-[#0066CC] dark:text-[#58A6FF]" />
                          <span className="text-xs font-bold leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
                            افزودن عکس و قیمت
                          </span>
                          <span className="text-[10.5px] font-medium leading-none px-2 py-1 rounded-full bg-[#F5F5F7] dark:!bg-white/[0.07] text-[#6E6E73] dark:text-[#98989F]">
                            اختیاری
                          </span>
                          {imagesList.length > 0 && (
                            <span className="text-[10.5px] font-bold leading-none px-2 py-1 rounded-full bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF]">
                              {imagesList.length.toLocaleString('fa-IR')} عکس
                            </span>
                          )}
                          {parsedPricePreview && (
                            <span className="text-[10.5px] font-bold leading-none px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 truncate max-w-[110px]">
                              {parsedPricePreview}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          size={15}
                          className={`block text-[#86868B] shrink-0 transition-transform duration-200 ${
                            showExtras ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {showExtras && (
                        <div className="px-3.5 pb-4 pt-3 border-t border-[#ECEFF4] dark:border-white/[0.06] space-y-3.5">
                          {/* Unified Optional Price + Quick "توافقی" Toggle */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="post-ad-price"
                                className="text-[11px] font-bold text-[#515154] dark:text-[#A1A1A6]"
                              >
                                قیمت
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setPriceNegotiable((prev) => {
                                    const next = !prev;
                                    if (next) setPrice('');
                                    return next;
                                  });
                                }}
                                className={`h-6 px-2.5 rounded-full text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${
                                  priceNegotiable
                                    ? 'bg-[#0066CC] text-white'
                                    : 'bg-[#FFFFFF] dark:!bg-white/[0.06] border border-[#ECEFF4] dark:border-white/[0.1] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white'
                                }`}
                              >
                                توافقی
                              </button>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                id="post-ad-price"
                                type="text"
                                inputMode="decimal"
                                disabled={priceNegotiable}
                                placeholder={priceNegotiable ? 'توافقی انتخاب شد' : 'مثال: ۱۲۰۰۰'}
                                value={priceNegotiable ? '' : price}
                                onChange={(e) => {
                                  if (priceNegotiable) setPriceNegotiable(false);
                                  setPrice(e.target.value);
                                }}
                                className={`${INPUT_CLASS} pl-16 disabled:opacity-60`}
                              />
                              <span className="pointer-events-none absolute left-3 text-[11px] font-bold text-[#86868B]">
                                {priceType === '€' ? 'یورو' : 'کرون'}
                              </span>
                            </div>
                          </div>

                          {/* Optional Photos */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#515154] dark:text-[#A1A1A6]">
                                عکس‌های آگهی (حداکثر ۴ عکس)
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
                                    : 'border-[#ECEFF4] dark:border-white/[0.14] hover:border-[#0066CC] bg-[#FFFFFF] dark:!bg-[#111318]'
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
                                    <Loader2 size={16} className="block shrink-0 text-[#0066CC] animate-spin" />
                                    <span className="text-xs font-bold leading-none text-[#0066CC] dark:text-[#58A6FF]">
                                      در حال بارگذاری عکس...
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Upload size={16} className="block shrink-0 text-[#86868B]" />
                                    <div className="text-right">
                                      <span className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                        انتخاب عکس از گالری
                                      </span>
                                      <span className="block text-[10px] text-[#86868B]">
                                        حداکثر ۱ مگابایت • فشرده‌سازی خودکار
                                      </span>
                                    </div>
                                  </>
                                )}
                              </label>
                            )}

                            {imagesList.length > 0 && (
                              <div className="grid grid-cols-4 gap-2">
                                {imagesList.map((url, idx) => (
                                  <div
                                    key={idx}
                                    className="relative aspect-square rounded-xl overflow-hidden border border-[#ECEFF4] dark:border-white/[0.1] bg-[#ECECEF] dark:bg-[#111318]"
                                  >
                                    <img
                                      src={url}
                                      alt={`عکس ${idx + 1}`}
                                      className="h-full w-full object-cover"
                                    />
                                    {idx === 0 && (
                                      <span className="absolute bottom-1 start-1 px-1.5 py-0.5 rounded-md bg-black/65 text-white text-[9.5px] font-bold leading-none">
                                        اصلی
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeImage(idx)}
                                      aria-label="حذف عکس"
                                      className="absolute top-1 end-1 h-6 w-6 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-colors"
                                      title="حذف عکس"
                                    >
                                      <X size={12} className="block shrink-0" />
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
                              <span>{showUrlFallback ? 'بستن کادر لینک' : '+ افزودن عکس با لینک مستقیم'}</span>
                            </button>

                            {showUrlFallback && (
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  dir="ltr"
                                  placeholder="https://..."
                                  value={imageUrl}
                                  onChange={(e) => setImageUrl(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addImage();
                                    }
                                  }}
                                  className="flex-1 h-9 rounded-xl border border-[#ECEFF4] dark:border-white/[0.1] bg-[#FFFFFF] dark:!bg-[#111318] px-3 text-xs text-[#1D1D1F] dark:text-white focus:border-[#0066CC] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={addImage}
                                  className="h-9 px-3.5 rounded-xl bg-[#ECECEF] dark:bg-white/[0.08] hover:bg-[#E2E2E7] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-white text-xs font-bold leading-none cursor-pointer"
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
                    STEP 2 — LOCATION (Country, Searchable City, Area & Map)
                ====================================================== */}
                {step === 2 && (
                  <div className="space-y-4">
                    {/* Country */}
                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        کشور <span className="text-rose-500">*</span>
                      </span>
                      <div
                        className={
                          activeCountries.length <= 8
                            ? 'grid grid-cols-4 gap-1.5'
                            : 'flex flex-wrap gap-1.5'
                        }
                      >
                        {activeCountries.map((c) => {
                          const selected = adCountry === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCountry(c)}
                              className={`h-9 px-2 rounded-xl text-[11.5px] sm:text-xs font-bold leading-none transition-all border cursor-pointer truncate ${
                                selected
                                  ? 'bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF] border-[#0066CC] dark:border-[#388BFD] ring-1 ring-[#0066CC]/30'
                                  : 'bg-[#FFFFFF] dark:!bg-[#111318] text-[#515154] dark:text-[#A1A1A6] border-[#ECEFF4] dark:border-white/[0.08] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.05]'
                              }`}
                            >
                              {c.nameFa}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Searchable City Combobox & Area/Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Custom Searchable City Picker */}
                      <div ref={cityDropdownRef} className="relative space-y-1.5">
                        <span className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          شهر <span className="text-rose-500">*</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCityDropdownOpen((prev) => {
                              const next = !prev;
                              if (next) {
                                setTimeout(() => citySearchInputRef.current?.focus(), 40);
                              } else {
                                setCityQuery('');
                              }
                              return next;
                            });
                          }}
                          aria-expanded={cityDropdownOpen}
                          aria-haspopup="listbox"
                          className={`${INPUT_CLASS} flex items-center justify-between gap-2 text-right cursor-pointer`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin size={14} className="block shrink-0 text-[#0066CC] dark:text-[#58A6FF]" />
                            <span className="truncate leading-none">
                              {currentCityObj?.fa || city}
                            </span>
                            {city && (
                              <span className="text-[10.5px] text-[#86868B] truncate" dir="ltr">
                                ({city})
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            size={14}
                            className={`block shrink-0 text-[#86868B] transition-transform duration-200 ${
                              cityDropdownOpen ? 'rotate-180 text-[#0066CC] dark:text-[#58A6FF]' : ''
                            }`}
                          />
                        </button>

                        {cityDropdownOpen && (
                          <div
                            role="listbox"
                            aria-label="انتخاب شهر"
                            className="absolute inset-x-0 top-full mt-1.5 z-30 rounded-2xl bg-[#FFFFFF] dark:!bg-[#1C1F28] border border-[#ECEFF4] dark:border-white/[0.1] shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-2 space-y-1.5"
                          >
                            {countryCities.length > 5 && (
                              <div className="relative flex items-center pb-1.5 border-b border-[#F0F2F5] dark:border-white/[0.06]">
                                <Search size={13} className="pointer-events-none absolute right-2.5 text-[#86868B]" />
                                <input
                                  ref={citySearchInputRef}
                                  type="text"
                                  value={cityQuery}
                                  onChange={(e) => setCityQuery(e.target.value)}
                                  placeholder="جستجوی شهر..."
                                  className="w-full h-8 pr-8 pl-7 rounded-xl bg-[#F5F5F7] dark:!bg-[#111318] text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] focus:outline-none focus:ring-1 focus:ring-[#0066CC]"
                                />
                                {cityQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setCityQuery('')}
                                    aria-label="پاک کردن جستجو"
                                    className="absolute left-2 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                                  >
                                    <X size={12} className="block" />
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                              {filteredCities.length === 0 ? (
                                <div className="py-3 text-center text-xs text-[#86868B]">
                                  شهری یافت نشد
                                </div>
                              ) : (
                                filteredCities.map((c) => {
                                  const isSelected = city === c.id;
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      onClick={() => handleSelectCity(c.id)}
                                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#EAF2FB] text-[#0066CC] dark:bg-[#0066CC]/20 dark:text-[#58A6FF] font-bold'
                                          : 'text-[#1D1D1F] dark:text-[#E5E5EA] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] font-semibold'
                                      }`}
                                    >
                                      <span className="truncate leading-none">{c.fa}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] text-[#86868B] leading-none" dir="ltr">
                                          {c.id}
                                        </span>
                                        {isSelected && (
                                          <Check size={13} strokeWidth={2.5} className="block shrink-0 text-[#0066CC] dark:text-[#58A6FF]" />
                                        )}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Address / Area with Integrated Map Search Trigger */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="post-ad-area"
                            className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                          >
                            محله یا آدرس
                          </label>
                          <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            id="post-ad-area"
                            type="text"
                            placeholder="نام محله، منطقه یا خیابان"
                            value={area}
                            onChange={(e) => {
                              setArea(e.target.value);
                              if (mapNotice) setMapNotice('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSearchAddressOnMap();
                              }
                            }}
                            className={`${INPUT_CLASS} pl-[92px]`}
                          />
                          <button
                            type="button"
                            disabled={searchingMap || area.trim().length < 2}
                            onClick={handleSearchAddressOnMap}
                            className="absolute left-1.5 h-8 px-2.5 rounded-lg bg-[#EAF2FB] hover:bg-[#DCEBFA] dark:bg-[#0066CC]/25 dark:hover:bg-[#0066CC]/35 text-[#0066CC] dark:text-[#58A6FF] text-[11px] font-bold leading-none inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            {searchingMap ? (
                              <Loader2 size={12} className="block shrink-0 animate-spin" />
                            ) : (
                              <Search size={12} className="block shrink-0" />
                            )}
                            <span className="leading-none">روی نقشه</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {mapNotice && (
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        {mapNotice}
                      </p>
                    )}

                    {/* Interactive Map Location Picker */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          انتخاب محدوده روی نقشه
                        </span>
                        <span className="text-[10.5px] font-medium text-[#86868B]">
                          اختیاری
                        </span>
                      </div>
                      <LocationMapPicker
                        lat={mapCoords.lat}
                        lng={mapCoords.lng}
                        zoom={mapZoom}
                        confirmed={mapConfirmed}
                        confirming={confirmingMap}
                        cityLabel={currentCityObj?.fa || city}
                        resolvedArea={resolvedMapArea}
                        onChangeCoords={(nextCoords) => {
                          setMapCoords(nextCoords);
                          if (mapConfirmed) setMapConfirmed(false);
                          if (mapNotice) setMapNotice('');
                        }}
                        onChangeZoom={setMapZoom}
                        onConfirm={handleConfirmMapLocation}
                        onUnconfirm={() => {
                          setMapConfirmed(false);
                          setResolvedMapArea('');
                        }}
                      />
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#98989F] leading-relaxed">
                        برای حفظ حریم خصوصی در آگهی‌های شخصی، کافی است پین را روی محدوده یا محله قرار دهید (نیازی به ثبت آدرس دقیق منزل نیست).
                      </p>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 3 — CONTACT (At Least 1 Required; Phone Optional)
                ====================================================== */}
                {step === 3 && (
                  <div className="space-y-3.5">
                    {/* Live Reactive Privacy & Requirement Banner (Single Lock Icon — No Emoji Duplication) */}
                    {activeContacts.length > 0 ? (
                      <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/90 dark:bg-emerald-500/12 border border-emerald-200 dark:border-emerald-500/30 px-3.5 py-2.5 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                            <Check size={12} strokeWidth={3} className="block shrink-0" />
                          </span>
                          <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 truncate">
                            {activeContacts.length.toLocaleString('fa-IR')} روش تماس ثبت شد
                          </span>
                        </div>
                        <span className="text-[10.5px] font-bold text-emerald-700/85 dark:text-emerald-400/90 shrink-0">
                          آماده ادامه
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl border px-3.5 py-3 transition-colors space-y-1 ${
                          contactHighlightError
                            ? 'bg-rose-50/90 dark:bg-rose-500/12 border-rose-300 dark:border-rose-500/35'
                            : 'bg-[#EAF2FB]/80 dark:bg-[#0066CC]/12 border-[#CDE0F5] dark:border-[#0066CC]/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Lock
                              size={14}
                              className={`block shrink-0 ${
                                contactHighlightError
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-[#0066CC] dark:text-[#58A6FF]'
                              }`}
                            />
                            <span className="text-xs font-extrabold text-[#1D1D1F] dark:text-white truncate">
                              ثبت حداقل یک روش تماس الزامی است
                            </span>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold leading-none tabular-nums ${
                              contactHighlightError
                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                : 'bg-[#FFFFFF]/90 dark:bg-white/[0.08] text-[#0066CC] dark:text-[#58A6FF] border border-[#CDE0F5] dark:border-white/[0.1]'
                            }`}
                          >
                            ۰ از ۱
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-[#515154] dark:text-[#C7C7CC] leading-relaxed">
                          شماره تلفن کاملاً اختیاری است؛ برای حفظ حریم خصوصی بیشتر، تلگرام یا ایمیل پیشنهاد می‌شود. اطلاعات تماس در موتورهای جستجو ثبت نمی‌شود و پشت تایید امنیتی محافظت می‌شود.
                        </p>
                      </div>
                    )}

                    {/* Tier 1: Privacy-Recommended Methods (Telegram + Email) */}
                    <div className="space-y-3">
                      <span className="block text-[11px] font-bold text-[#6E6E73] dark:text-[#98989F]">
                        روش‌های پیشنهادی (بدون نمایش شماره تلفن)
                      </span>

                      {/* Telegram Username + Inline Help Pill */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="post-ad-telegram"
                              className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                            >
                              نام کاربری تلگرام
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenHelp((prev) => (prev === 'telegram' ? null : 'telegram'))
                              }
                              aria-label="راهنمای یافتن نام کاربری تلگرام"
                              aria-expanded={openHelp === 'telegram'}
                              className={`h-6 px-2 rounded-full inline-flex items-center gap-1 text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${
                                openHelp === 'telegram'
                                  ? 'bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF]'
                                  : 'bg-[#F5F5F7] dark:!bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#0066CC]'
                              }`}
                            >
                              <HelpCircle size={11} className="block shrink-0" />
                              <span className="leading-none">راهنما</span>
                            </button>
                          </div>
                          <span className="text-[10.5px] font-semibold text-[#0066CC] dark:text-[#58A6FF]">
                            پیشنهادی
                          </span>
                        </div>

                        {openHelp === 'telegram' && (
                          <div className="rounded-xl bg-[#F5F5F7] dark:!bg-white/[0.04] border border-[#ECEFF4] dark:border-white/[0.08] border-s-2 border-s-[#0066CC] px-3 py-2 text-[11px] text-[#515154] dark:text-[#C7C7CC] leading-relaxed">
                            در تلگرام به{' '}
                            <bdi dir="ltr" className="font-mono font-semibold text-[#1D1D1F] dark:text-white">
                              Settings → Username
                            </bdi>{' '}
                            بروید و نام کاربری خود (مثلاً{' '}
                            <bdi dir="ltr" className="font-mono">@username</bdi>) را وارد کنید. در این روش شماره تلفن شما نمایش داده نمی‌شود.
                          </div>
                        )}

                        <div className="relative group">
                          <Send
                            size={14}
                            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                              contactTelegram.trim()
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-[#86868B] group-focus-within:text-[#0066CC]'
                            }`}
                          />
                          <input
                            id="post-ad-telegram"
                            type="text"
                            placeholder="@username"
                            value={contactTelegram}
                            onChange={(e) => {
                              setContactTelegram(e.target.value);
                              if (contactHighlightError) setContactHighlightError(false);
                            }}
                            className={`${INPUT_CLASS} text-left font-mono pl-9 pr-9 ${
                              contactTelegram.trim() ? 'border-emerald-300/90 dark:border-emerald-500/40' : ''
                            }`}
                            dir="ltr"
                          />
                          {contactTelegram.trim() && isValidTelegramInput(contactTelegram) && (
                            <Check
                              size={14}
                              strokeWidth={2.5}
                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                            />
                          )}
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="post-ad-email"
                            className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                          >
                            ایمیل
                          </label>
                          <span className="text-[10.5px] font-semibold text-[#0066CC] dark:text-[#58A6FF]">
                            پیشنهادی
                          </span>
                        </div>
                        <div className="relative group">
                          <Mail
                            size={14}
                            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                              contactEmail.trim()
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-[#86868B] group-focus-within:text-[#0066CC]'
                            }`}
                          />
                          <input
                            id="post-ad-email"
                            type="email"
                            placeholder="email@example.com"
                            value={contactEmail}
                            onChange={(e) => {
                              setContactEmail(e.target.value);
                              if (contactHighlightError) setContactHighlightError(false);
                            }}
                            className={`${INPUT_CLASS} text-left pl-9 pr-9 ${
                              contactEmail.trim() ? 'border-emerald-300/90 dark:border-emerald-500/40' : ''
                            }`}
                            dir="ltr"
                          />
                          {contactEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()) && (
                            <Check
                              size={14}
                              strokeWidth={2.5}
                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subtle Divider */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <div className="h-px flex-1 bg-[#ECEFF4] dark:bg-white/[0.06]" />
                      <span className="text-[10.5px] font-medium text-[#86868B]">
                        سایر راه‌های تماس (اختیاری)
                      </span>
                      <div className="h-px flex-1 bg-[#ECEFF4] dark:bg-white/[0.06]" />
                    </div>

                    {/* Tier 2: WhatsApp, Phone, Website */}
                    <div className="space-y-3">
                      {/* WhatsApp Username or Number + Honest Help Pill */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="post-ad-whatsapp"
                              className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                            >
                              واتساپ (نام کاربری یا شماره)
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenHelp((prev) => (prev === 'whatsapp' ? null : 'whatsapp'))
                              }
                              aria-label="راهنمای ثبت واتساپ"
                              aria-expanded={openHelp === 'whatsapp'}
                              className={`h-6 px-2 rounded-full inline-flex items-center gap-1 text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${
                                openHelp === 'whatsapp'
                                  ? 'bg-[#EAF2FB] dark:bg-[#0066CC]/20 text-[#0066CC] dark:text-[#58A6FF]'
                                  : 'bg-[#F5F5F7] dark:!bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#0066CC]'
                              }`}
                            >
                              <HelpCircle size={11} className="block shrink-0" />
                              <span className="leading-none">راهنما</span>
                            </button>
                          </div>
                          <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                        </div>

                        {openHelp === 'whatsapp' && (
                          <div className="rounded-xl bg-[#F5F5F7] dark:!bg-white/[0.04] border border-[#ECEFF4] dark:border-white/[0.08] border-s-2 border-s-[#0066CC] px-3 py-2 text-[11px] text-[#515154] dark:text-[#C7C7CC] leading-relaxed">
                            اگر در واتساپ در مسیر{' '}
                            <bdi dir="ltr" className="font-mono font-semibold text-[#1D1D1F] dark:text-white">
                              Settings → Profile
                            </bdi>{' '}
                            گزینه{' '}
                            <bdi dir="ltr" className="font-mono font-semibold text-[#1D1D1F] dark:text-white">
                              Username
                            </bdi>{' '}
                            برای شما فعال است، آن را وارد کنید؛ در غیر این صورت شماره واتساپ با کد کشور یا لینک{' '}
                            <bdi dir="ltr" className="font-mono">wa.me</bdi> بنویسید.
                          </div>
                        )}

                        <div className="relative group">
                          <MessageCircle
                            size={14}
                            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                              contactWhatsapp.trim()
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-[#86868B] group-focus-within:text-[#0066CC]'
                            }`}
                          />
                          <input
                            id="post-ad-whatsapp"
                            type="text"
                            placeholder={`@username یا ${phonePlaceholder.replace(/\s+/g, '')}`}
                            value={contactWhatsapp}
                            onChange={(e) => {
                              setContactWhatsapp(e.target.value);
                              if (contactHighlightError) setContactHighlightError(false);
                            }}
                            className={`${INPUT_CLASS} text-left font-mono pl-9 pr-9 ${
                              contactWhatsapp.trim() ? 'border-emerald-300/90 dark:border-emerald-500/40' : ''
                            }`}
                            dir="ltr"
                          />
                          {contactWhatsapp.trim() && isValidWhatsAppInput(contactWhatsapp) && (
                            <Check
                              size={14}
                              strokeWidth={2.5}
                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                            />
                          )}
                        </div>
                      </div>

                      {/* Phone & Website */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor="post-ad-phone"
                              className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                            >
                              شماره تلفن
                            </label>
                            <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                          </div>
                          <div className="relative group">
                            <Phone
                              size={14}
                              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                                contactPhone.trim()
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[#86868B] group-focus-within:text-[#0066CC]'
                              }`}
                            />
                            <input
                              id="post-ad-phone"
                              type="tel"
                              placeholder={phonePlaceholder}
                              value={contactPhone}
                              onChange={(e) => {
                                setContactPhone(e.target.value);
                                if (contactHighlightError) setContactHighlightError(false);
                              }}
                              className={`${INPUT_CLASS} text-left font-mono pl-9 pr-9 ${
                                contactPhone.trim() ? 'border-emerald-300/90 dark:border-emerald-500/40' : ''
                              }`}
                              dir="ltr"
                            />
                            {contactPhone.trim() &&
                              normalizeAsciiDigits(contactPhone).replace(/\D/g, '').length >= 6 && (
                                <Check
                                  size={14}
                                  strokeWidth={2.5}
                                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                                />
                              )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor="post-ad-website"
                              className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]"
                            >
                              وب‌سایت
                            </label>
                            <span className="text-[10.5px] font-medium text-[#86868B]">اختیاری</span>
                          </div>
                          <div className="relative group">
                            <Globe
                              size={14}
                              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                                contactWebsite.trim()
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[#86868B] group-focus-within:text-[#0066CC]'
                              }`}
                            />
                            <input
                              id="post-ad-website"
                              type="url"
                              placeholder="https://example.com"
                              value={contactWebsite}
                              onChange={(e) => {
                                setContactWebsite(e.target.value);
                                if (contactHighlightError) setContactHighlightError(false);
                              }}
                              className={`${INPUT_CLASS} text-left font-mono pl-9 pr-9 ${
                                contactWebsite.trim() ? 'border-emerald-300/90 dark:border-emerald-500/40' : ''
                              }`}
                              dir="ltr"
                            />
                            {contactWebsite.trim() && isValidWebsiteInput(contactWebsite) && (
                              <Check
                                size={14}
                                strokeWidth={2.5}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 4 — PUBLISH (4 Clean Zones)
                ====================================================== */}
                {step === 4 && (
                  <div className="space-y-3.5">
                    {/* Zone 1: Compact Ad Preview Card */}
                    <div className="rounded-2xl border border-[#ECEFF4] dark:border-white/[0.08] bg-[#FFFFFF] dark:!bg-[#1C1F28] divide-y divide-[#F0F2F5] dark:divide-white/[0.06] overflow-hidden">
                      {/* Row 1: Identity (Thumbnail + Title + Category + Price + Edit) */}
                      <div className="p-3.5 flex items-start gap-3">
                        {imagesList[0] && (
                          <img
                            src={imagesList[0]}
                            alt=""
                            className="h-12 w-12 rounded-xl object-cover border border-[#ECEFF4] dark:border-white/[0.1] shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] dark:text-white truncate">
                              {title.trim()}
                            </h4>
                            <span className="text-[10px] font-bold leading-none px-2 py-0.5 rounded-full bg-[#F5F5F7] dark:!bg-white/[0.08] text-[#515154] dark:text-[#C7C7CC]">
                              {currentCategoryObj?.fa || category}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] line-clamp-1">
                            {description.trim()}
                          </p>
                          {(parsedPricePreview || imagesList.length > 0) && (
                            <div className="flex items-center gap-2 text-[11px] flex-wrap">
                              {parsedPricePreview && (
                                <span className="font-extrabold text-[#0066CC] dark:text-[#58A6FF]">
                                  {parsedPricePreview}
                                </span>
                              )}
                              {imagesList.length > 0 && (
                                <span className="text-[#86868B]">
                                  {parsedPricePreview ? '• ' : ''}
                                  {imagesList.length.toLocaleString('fa-IR')} عکس
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(1)}
                          aria-label="ویرایش اطلاعات"
                          title="ویرایش اطلاعات"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0066CC] dark:text-[#58A6FF] hover:bg-[#EAF2FB] dark:hover:bg-[#0066CC]/20 transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil size={13} className="block shrink-0" />
                        </button>
                      </div>

                      {/* Row 2: Location + Contact Pills */}
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <MapPin size={13} className="block shrink-0 text-[#86868B]" />
                            <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                              {currentCountryObj.nameFa}، {currentCityObj?.fa || city}
                              {area.trim() ? ` — ${area.trim()}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(2)}
                            aria-label="ویرایش موقعیت"
                            title="ویرایش موقعیت"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0066CC] dark:text-[#58A6FF] hover:bg-[#EAF2FB] dark:hover:bg-[#0066CC]/20 transition-colors cursor-pointer shrink-0"
                          >
                            <Pencil size={13} className="block shrink-0" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5 min-w-0">
                            {activeContacts.length > 0 ? (
                              activeContacts.map((item) => {
                                const CIcon = item.Icon;
                                return (
                                  <span
                                    key={item.label}
                                    className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-[#F5F5F7] dark:!bg-white/[0.07] text-[11px] font-semibold leading-none text-[#1D1D1F] dark:text-[#E5E5EA]"
                                  >
                                    <CIcon size={11} className="block shrink-0 text-[#86868B]" />
                                    <span className="leading-none">{item.label}:</span>
                                    <bdi dir="ltr" className="font-mono text-[10.5px] leading-none truncate max-w-[125px]">
                                      {item.value}
                                    </bdi>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                حداقل یک روش تماس الزامی است.
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(3)}
                            aria-label="ویرایش تماس"
                            title="ویرایش تماس"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0066CC] dark:text-[#58A6FF] hover:bg-[#EAF2FB] dark:hover:bg-[#0066CC]/20 transition-colors cursor-pointer shrink-0"
                          >
                            <Pencil size={13} className="block shrink-0" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Zone 2: Standard vs VIP Radio Cards */}
                    {vipEnabled && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setWantVipPromotion(false)}
                          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer space-y-1.5 ${
                            !wantVipPromotion
                              ? 'bg-[#EAF2FB]/75 dark:bg-[#0066CC]/15 border-[#0066CC] dark:border-[#388BFD] ring-1 ring-[#0066CC] dark:ring-[#388BFD]'
                              : 'bg-[#FFFFFF] dark:!bg-[#1C1F28] border-[#ECEFF4] dark:border-white/[0.08] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-extrabold leading-none text-[#1D1D1F] dark:text-white">
                              آگهی عادی
                            </span>
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${
                                !wantVipPromotion
                                  ? 'bg-[#0066CC] border-[#0066CC] text-white'
                                  : 'border-[#D2D2D7] dark:border-white/20'
                              }`}
                            >
                              {!wantVipPromotion && <Check size={10} strokeWidth={3} className="block" />}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-1 flex-wrap">
                            <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                              رایگان
                            </span>
                            <span className="text-[10px] text-[#6E6E73] dark:text-[#98989F]">
                              انتشار در فهرست
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setWantVipPromotion(true)}
                          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer space-y-1.5 ${
                            wantVipPromotion
                              ? 'bg-amber-50/80 dark:bg-amber-500/12 border-amber-400 dark:border-amber-500/70 ring-1 ring-amber-400/70'
                              : 'bg-[#FFFFFF] dark:!bg-[#1C1F28] border-[#ECEFF4] dark:border-white/[0.08] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold leading-none text-[#1D1D1F] dark:text-white">
                              <Crown size={12} className="block shrink-0 text-amber-500" />
                              <span className="leading-none">ویژه (VIP)</span>
                            </span>
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${
                                wantVipPromotion
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'border-[#D2D2D7] dark:border-white/20'
                              }`}
                            >
                              {wantVipPromotion && <Check size={10} strokeWidth={3} className="block" />}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-1 flex-wrap">
                            <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
                              {vipPriceLabel}
                            </span>
                            <span className="text-[10px] text-[#6E6E73] dark:text-[#98989F]">
                              صدر آگهی‌های {currentCountryObj.nameFa}
                            </span>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Zone 3: Set / Confirm Management Code (PIN) */}
                    <div className="rounded-2xl border border-[#ECEFF4] dark:border-white/[0.08] bg-[#F5F5F7]/80 dark:!bg-[#111318] p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="post-ad-pin"
                          className="inline-flex items-center gap-1.5 text-xs font-bold leading-none text-[#1D1D1F] dark:text-[#F5F5F7]"
                        >
                          <KeyRound size={14} className="block shrink-0 text-[#0066CC] dark:text-[#58A6FF]" />
                          <span className="leading-none">کد مدیریت اختصاصی</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setManagePin(generateClientPin())}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold leading-none text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                          title="تولید کد جدید"
                        >
                          <RefreshCw size={11} className="block shrink-0" />
                          <span className="leading-none">کد جدید</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="post-ad-pin"
                          type="text"
                          dir="ltr"
                          maxLength={12}
                          value={managePin}
                          onChange={(e) => setManagePin(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          placeholder="۶ تا ۱۲ رقم یا حرف انگلیسی"
                          className={`flex-1 h-10 rounded-xl border bg-[#FFFFFF] dark:!bg-[#171920] px-3 text-center font-mono text-sm font-black focus:outline-none transition-colors ${
                            isPinValid
                              ? 'border-[#ECEFF4] dark:border-white/[0.1] text-[#1D1D1F] dark:text-white focus:border-[#0066CC]'
                              : 'border-rose-400 text-rose-600 dark:text-rose-400'
                          }`}
                        />
                        <button
                          type="button"
                          disabled={!isPinValid}
                          onClick={() => copyToClipboard(cleanPinCandidate, 'previewPin')}
                          className={`h-10 px-3.5 rounded-xl border text-xs font-bold leading-none inline-flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 transition-all disabled:opacity-45 disabled:pointer-events-none ${
                            pinCopiedPreview
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
                              : 'bg-[#FFFFFF] dark:!bg-white/[0.08] hover:bg-[#ECECEF] dark:hover:bg-white/[0.14] border-[#ECEFF4] dark:border-white/[0.1] text-[#1D1D1F] dark:text-white'
                          }`}
                        >
                          {pinCopiedPreview ? (
                            <Check size={13} className="block shrink-0" />
                          ) : (
                            <Copy size={13} className="block shrink-0" />
                          )}
                          <span className="leading-none">{pinCopiedPreview ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>

                      {!isPinValid ? (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          کد مدیریت باید ۶ تا ۱۲ رقم یا حرف انگلیسی باشد.
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#6E6E73] dark:text-[#98989F] leading-relaxed">
                          این کد محرمانه است و در آگهی نمایش داده نمی‌شود؛ برای ویرایش، بوست یا حذف آگهی به آن نیاز دارید.
                        </p>
                      )}
                    </div>

                    {/* Zone 4: Unified Final Verification Card (Rules + Turnstile) */}
                    <div
                      className={`rounded-2xl border overflow-hidden divide-y divide-[#F0F2F5] dark:divide-white/[0.06] transition-colors ${
                        rulesHighlightError
                          ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-500/10'
                          : 'border-[#ECEFF4] dark:border-white/[0.08] bg-[#FFFFFF] dark:!bg-[#1C1F28]'
                      }`}
                    >
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={rulesAccepted}
                              onChange={(e) => {
                                setRulesAccepted(e.target.checked);
                                if (e.target.checked) {
                                  setRulesHighlightError(false);
                                  setErrorMsg('');
                                }
                              }}
                              className="sr-only"
                            />
                            <span
                              aria-hidden="true"
                              className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-colors shrink-0 ${
                                rulesAccepted
                                  ? 'bg-[#0066CC] border-[#0066CC] text-white'
                                  : rulesHighlightError
                                    ? 'bg-[#FFFFFF] dark:!bg-[#111318] border-rose-400'
                                    : 'bg-[#FFFFFF] dark:!bg-[#111318] border-[#D2D2D7] dark:border-white/25'
                              }`}
                            >
                              {rulesAccepted && <Check size={11} strokeWidth={3} className="block" />}
                            </span>
                            <span className="text-xs font-bold leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
                              قوانین انتشار آگهی را می‌پذیرم <span className="text-rose-500">*</span>
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowRulesDetails((v) => !v)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold leading-none text-[#0066CC] dark:text-[#58A6FF] shrink-0 cursor-pointer"
                          >
                            <ShieldCheck size={12} className="block shrink-0" />
                            <span className="leading-none">
                              {showRulesDetails ? 'بستن قوانین' : 'مشاهده قوانین'}
                            </span>
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

                      {turnstileSettings.enabled !== false &&
                        turnstileSettings.protectPostAd !== false && (
                          <div className="p-3 bg-[#FBFBFC]/60 dark:!bg-[#111318]/60 flex justify-center">
                            <CloudflareTurnstile
                              key={turnstileResetKey}
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
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky Bottom Action Bar */}
          {!successData && (
            <div className="px-4 sm:px-6 py-3.5 bg-[#FBFBFC] dark:!bg-[#171920] border-t border-[#ECEFF4] dark:border-white/[0.06] flex items-center gap-2.5 shrink-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="h-11 px-4 sm:px-5 rounded-full border border-[#ECEFF4] dark:border-white/[0.1] bg-[#F5F5F7] hover:bg-[#ECECEF] dark:!bg-white/[0.06] dark:hover:bg-white/[0.1] text-[#1D1D1F] dark:text-[#F5F5F7] font-bold text-xs leading-none inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.95] cursor-pointer shrink-0"
                >
                  <ChevronRight size={16} className="block shrink-0" />
                  <span className="leading-none">قبلی</span>
                </button>
              )}

              {step < 4 ? (
                <button
                  type="submit"
                  disabled={step === 1 && (descriptionHasLink || uploadingPhotos)}
                  className={`flex-1 h-11 rounded-full text-white font-bold text-xs sm:text-sm leading-none inline-flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    step === 3 && activeContacts.length === 0
                      ? 'bg-[#0066CC]/65 hover:bg-[#0066CC]/80'
                      : 'bg-[#0066CC] hover:bg-[#0055AA]'
                  }`}
                >
                  <span className="leading-none">
                    {step === 1
                      ? 'ادامه: موقعیت'
                      : step === 2
                        ? 'ادامه: راه‌های تماس'
                        : 'ادامه: بررسی و ثبت'}
                  </span>
                  <ChevronLeft size={17} className="block shrink-0" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || descriptionHasLink}
                  className="flex-1 h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm leading-none inline-flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.97] cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={16} className="block shrink-0 animate-spin" />
                  ) : (
                    <PlusCircle size={16} className="block shrink-0" />
                  )}
                  <span className="leading-none">
                    {loading
                      ? 'در حال ثبت آگهی...'
                      : wantVipPromotion && vipEnabled
                        ? `ثبت و ارتقای ویژه (${vipPriceLabel})`
                        : 'ثبت رایگان آگهی'}
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
