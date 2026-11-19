import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  PlusCircle,
  Plus,
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
  Link2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  CopyCheck,
  HelpCircle,
  Lock,
  Crown,
  Phone,
  Mail,
  Globe,
  Pencil,
  Star,
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
import GoogleMapEmbed from './GoogleMapEmbed';
import { isSafeHttpUrl } from '../lib/urlUtils';
import { publicApi } from '../lib/apiClient';
import { saveAdCredential } from '../lib/myAdsStorage';
import {
  buildGoogleMapsQuery,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
} from '../lib/googleMaps';
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
    return Boolean(
      u.hostname &&
        u.hostname.includes('.') &&
        !u.hostname.startsWith('.') &&
        !u.hostname.endsWith('.')
    );
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
  { num: 1, shortLabel: 'امنیت', subtitle: 'حریم خصوصی، امنیت و قوانین انتشار' },
  { num: 2, shortLabel: 'اطلاعات آگهی', subtitle: 'انتخاب نوع تبلیغ و مشخصات آگهی' },
  { num: 3, shortLabel: 'تماس و نقشه', subtitle: 'راه‌های تماس و موقعیت روی نقشه گوگل' },
  { num: 4, shortLabel: 'تصویر و VIP', subtitle: 'افزودن عکس، پیشنهاد VIP و انتشار' },
];

const INPUT_CLASS =
  'w-full h-11 rounded-xl border border-[#ECEFF4] dark:!border-white/[0.12] bg-[#FFFFFF] dark:bg-[#1C1F28] px-3.5 text-xs sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#787880] focus:border-[#0066CC] dark:focus:!border-[#3B9BFF] focus:ring-2 focus:ring-[#0066CC]/15 focus:outline-none transition-colors';

const COMPACT_INPUT_CLASS =
  'w-full h-11 sm:h-10 rounded-xl border border-[#ECEFF4] dark:!border-white/[0.12] bg-[#FFFFFF] dark:bg-[#1C1F28] px-3 text-xs sm:text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#787880] focus:border-[#0066CC] dark:focus:!border-[#3B9BFF] focus:ring-2 focus:ring-[#0066CC]/15 focus:outline-none transition-colors';

export default function PostAdModal({
  initialCategory = 'bostad',
  selectedCountry = 'se',
  countries = COUNTRIES,
  lifecycleSettings = null,
  turnstileSettings: propTurnstileSettings = null,
  googleMapsSettings = { enabled: true, embedApiKey: '', defaultZoom: 14 },
  stripeSettings = null,
  onClose,
  onCreated,
  onOpenManageExisting,
  onProceedToVip,
}) {
  const currentT = t.fa;
  const fullPolicyRules = buildAdPolicyRules(lifecycleSettings || {});
  const compactPolicyRules = [fullPolicyRules[0], fullPolicyRules[2], fullPolicyRules[4]].filter(Boolean);
  const activeCountries = useMemo(
    () =>
      Array.isArray(countries) && countries.length > 0
        ? countries.filter((c) => c.enabled !== false)
        : COUNTRIES,
    [countries]
  );

  const initialCountryId = selectedCountry === 'all' ? 'se' : (selectedCountry || 'se');
  const initialCountryObj =
    activeCountries.find((c) => c.id === initialCountryId) || activeCountries[0];
  const initialCityId =
    initialCountryObj.cities.find((c) => c.id !== 'all')?.id || 'Stockholm';

  // Step 1: Security & Rules | Step 2: Ad Type & Info | Step 3: Contact & Google Map | Step 4: Photos, VIP & Publish
  const [step, setStep] = useState(1);
  const bodyScrollRef = useRef(null);
  const countryDropdownRef = useRef(null);
  const cityDropdownRef = useRef(null);
  const citySearchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Step 1 — Security & Rules
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesHighlightError, setRulesHighlightError] = useState(false);
  const [showAllRules, setShowAllRules] = useState(false);

  // Step 2 — Ad Type & Core Info
  const [category, setCategory] = useState(initialCategory || 'bostad');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [priceType, setPriceType] = useState(initialCountryObj.currency || 'kr');

  // Step 3 — Contact (≥1 required, phone optional) & Location + Free Google Map
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [openHelp, setOpenHelp] = useState(null); // null | 'telegram' | 'whatsapp'
  const [contactHighlightError, setContactHighlightError] = useState(false);

  const [adCountry, setAdCountry] = useState(initialCountryId);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [city, setCity] = useState(initialCityId);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [area, setArea] = useState('');
  const [debouncedArea, setDebouncedArea] = useState('');

  // Step 4 — Photos (Upload OR Direct Link) + VIP Offer + Turnstile
  const [photoInputMode, setPhotoInputMode] = useState('upload'); // 'upload' | 'link'
  const [imageUrl, setImageUrl] = useState('');
  const [imagesList, setImagesList] = useState([]);
  const [imageHashes, setImageHashes] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);

  const vipEnabled = stripeSettings?.enabled !== false;
  const [wantVipPromotion, setWantVipPromotion] = useState(false);
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

  // Derived data
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
  const phonePlaceholder = COUNTRY_PHONE_PLACEHOLDERS[adCountry] || '+46 70 123 45 67';

  // Debounce area typing (450ms) so Google Maps iframe updates smoothly without spamming reloads
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedArea(area.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [area]);

  const googleMapQuery = useMemo(
    () =>
      buildGoogleMapsQuery({
        area: debouncedArea,
        city,
        country: adCountry,
        countries: activeCountries,
      }),
    [debouncedArea, city, adCountry, activeCountries]
  );

  const googleMapEmbedUrl = useMemo(
    () =>
      buildGoogleMapsEmbedUrl({
        query: googleMapQuery,
        country: adCountry,
        hasArea: debouncedArea.length >= 2,
        settings: googleMapsSettings,
      }),
    [googleMapQuery, adCountry, debouncedArea, googleMapsSettings]
  );

  const googleMapSearchUrl = useMemo(
    () => buildGoogleMapsSearchUrl(googleMapQuery),
    [googleMapQuery]
  );

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
      if (countryDropdownOpen) {
        setCountryDropdownOpen(false);
        return;
      }
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
  }, [countryDropdownOpen, cityDropdownOpen, openHelp, onClose]);

  // Outside click for Country & City popovers
  useEffect(() => {
    if (!countryDropdownOpen && !cityDropdownOpen) return undefined;
    const handleOutside = (e) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
        setCountryDropdownOpen(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target)) {
        setCityDropdownOpen(false);
        setCityQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [countryDropdownOpen, cityDropdownOpen]);

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((k) => k + 1);
  };

  const handleSelectCountry = (c) => {
    setAdCountry(c.id);
    const firstCity = c.cities.find((ct) => ct.id !== 'all')?.id || '';
    setCity(firstCity);
    setPriceType(c.currency || 'kr');
    setCountryDropdownOpen(false);
    setCityDropdownOpen(false);
    setCityQuery('');
  };

  const handleSelectCity = (nextCity) => {
    setCity(nextCity);
    setCityDropdownOpen(false);
    setCityQuery('');
  };

  // Photo upload & link helpers (Step 4)
  const addImageByUrl = () => {
    setErrorMsg('');
    if (imagesList.length >= MAX_PHOTOS) {
      showError('حداکثر ۴ عکس می‌توانید برای هر آگهی اضافه کنید.');
      return;
    }
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    if (!isSafeHttpUrl(trimmed)) {
      showError('لطفاً لینک مستقیم معتبر تصویر (شروع با https://) وارد کنید.');
      return;
    }
    setImagesList((prev) => [...prev, trimmed].slice(0, MAX_PHOTOS));
    setImageHashes((prev) => [...prev, ''].slice(0, MAX_PHOTOS));
    setImageUrl('');
  };

  const processSelectedFiles = async (fileArray) => {
    const selectedFiles = Array.from(fileArray || []);
    if (selectedFiles.length === 0) return;

    setErrorMsg('');
    const remainingSlots = MAX_PHOTOS - imagesList.length;
    if (remainingSlots <= 0) {
      showError('حداکثر ۴ عکس می‌توانید برای هر آگهی اضافه کنید.');
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      showError(
        `فقط ${remainingSlots.toLocaleString('fa-IR')} عکس دیگر می‌توانید اضافه کنید (حداکثر ۴ عکس).`
      );
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
      const uploadedHashes = results.map((r) => r.fileHash || '');
      if (uploadedUrls.length > 0) {
        setImagesList((prev) => [...prev, ...uploadedUrls].slice(0, MAX_PHOTOS));
        setImageHashes((prev) => [...prev, ...uploadedHashes].slice(0, MAX_PHOTOS));
      }
    } catch (err) {
      showError(err.message || 'بارگذاری عکس انجام نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    await processSelectedFiles(selectedFiles);
  };

  const handleDropPhotos = async (e) => {
    e.preventDefault();
    setDragOverUpload(false);
    if (uploadingPhotos || imagesList.length >= MAX_PHOTOS) return;
    await processSelectedFiles(e.dataTransfer?.files);
  };

  const removeImage = (index) => {
    setImagesList((prev) => prev.filter((_, i) => i !== index));
    setImageHashes((prev) => prev.filter((_, i) => i !== index));
  };

  const makePrimaryImage = (index) => {
    if (index <= 0 || index >= imagesList.length) return;
    setImagesList((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      return [picked, ...next];
    });
    setImageHashes((prev) => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      return [picked ?? '', ...next];
    });
  };

  // Contact summary & validation
  const activeContacts = [
    contactTelegram.trim() && { label: 'تلگرام', value: contactTelegram.trim(), Icon: Send },
    contactEmail.trim() && { label: 'ایمیل', value: contactEmail.trim(), Icon: Mail },
    contactWhatsapp.trim() && { label: 'واتساپ', value: contactWhatsapp.trim(), Icon: MessageCircle },
    contactPhone.trim() && { label: 'تلفن', value: contactPhone.trim(), Icon: Phone },
    contactWebsite.trim() && { label: 'وب‌سایت', value: contactWebsite.trim(), Icon: Globe },
  ].filter(Boolean);

  const isTelegramValid =
    Boolean(contactTelegram.trim()) && isValidTelegramInput(contactTelegram);
  const isEmailValid =
    Boolean(contactEmail.trim()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
  const isWhatsappValid =
    Boolean(contactWhatsapp.trim()) && isValidWhatsAppInput(contactWhatsapp);
  const isPhoneValid =
    Boolean(contactPhone.trim()) &&
    normalizeAsciiDigits(contactPhone).replace(/\D/g, '').length >= 6;
  const isWebsiteValid =
    Boolean(contactWebsite.trim()) && isValidWebsiteInput(contactWebsite);

  const parsedPricePreview = useMemo(() => {
    if (priceNegotiable) return 'توافقی';
    const rawTrimmed = String(price || '').trim();
    if (!rawTrimmed) return '';
    if (/توافقی/.test(rawTrimmed)) return 'توافقی';
    const num = parseFloat(normalizeAsciiDigits(rawTrimmed).replace(/,/g, ''));
    if (!Number.isFinite(num) || num <= 0) return '';
    const unitLabel =
      !priceType || priceType === 'kr' ? 'کرون' : priceType === '€' ? 'یورو' : priceType;
    return `${num.toLocaleString('fa-IR')} ${unitLabel}`;
  }, [price, priceNegotiable, priceType]);

  const validateStep1 = () => {
    if (!rulesAccepted) {
      setRulesHighlightError(true);
      showError('لطفاً پیش از ادامه، قوانین انتشار آگهی را تایید کنید.');
      return false;
    }
    setRulesHighlightError(false);
    return true;
  };

  const validateStep2 = () => {
    if (!category || !title.trim() || !description.trim()) {
      showError('لطفاً نوع تبلیغ، عنوان و توضیحات آگهی را وارد کنید.');
      return false;
    }
    if (containsLinkInDescription(description)) {
      showError(DESCRIPTION_LINK_ERROR_MSG);
      return false;
    }
    const modCheck = checkProhibitedContent({ title, description });
    if (modCheck.blocked) {
      showError(modCheck.reason);
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
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
    if (!adCountry || !city) {
      showError('لطفاً کشور و شهر محل آگهی را انتخاب کنید.');
      return false;
    }
    return true;
  };

  const goToStep = (targetStep) => {
    setErrorMsg('');
    setOpenHelp(null);
    setCountryDropdownOpen(false);
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
    setCountryDropdownOpen(false);
    setCityDropdownOpen(false);

    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      scrollBodyTop();
      return;
    }

    if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
      scrollBodyTop();
      return;
    }

    if (step === 3) {
      if (!validateStep3()) return;
      setStep(4);
      scrollBodyTop();
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setOpenHelp(null);
    setCountryDropdownOpen(false);
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

    if (uploadingPhotos) {
      showError('لطفاً تا پایان بارگذاری تصاویر صبر کنید.');
      return;
    }

    if (!validateStep1()) {
      setStep(1);
      return;
    }

    if (!validateStep2()) {
      setStep(2);
      return;
    }

    if (!validateStep3()) {
      setStep(3);
      return;
    }

    const modCheck = checkProhibitedContent({ title, description, area });
    if (modCheck.blocked) {
      showError(modCheck.reason);
      return;
    }

    const turnstileRequired =
      turnstileSettings.enabled !== false && turnstileSettings.protectPostAd !== false;
    if (turnstileRequired && !turnstileToken) {
      showError('لطفاً تایید امنیتی کلودفلر را تکمیل کنید.');
      return;
    }

    setLoading(true);
    try {
      const allImages = imagesList.filter(isSafeHttpUrl).slice(0, MAX_PHOTOS);
      if (allImages.length < MAX_PHOTOS && imageUrl.trim() && isSafeHttpUrl(imageUrl.trim())) {
        allImages.push(imageUrl.trim());
      }
      const cleanHashes = imageHashes.filter(Boolean).slice(0, MAX_PHOTOS);

      const rawPriceTrimmed = String(price || '').trim();
      const userTypedTavafoghi =
        priceNegotiable || /توافقی/.test(rawPriceTrimmed) || /توافقی/.test(String(priceType || ''));
      const normalizedPriceDigits = normalizeAsciiDigits(rawPriceTrimmed).replace(/,/g, '');
      const parsedNumPrice = parseFloat(normalizedPriceDigits);
      const hasValidNumPrice =
        !priceNegotiable && Number.isFinite(parsedNumPrice) && parsedNumPrice > 0;

      const trimmedWebsite = contactWebsite.trim();
      const normalizedWebsite = trimmedWebsite
        ? /^https?:\/\//i.test(trimmedWebsite)
          ? trimmedWebsite
          : `https://${trimmedWebsite}`
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
        contact_whatsapp: contactWhatsapp.trim()
          ? normalizeAsciiDigits(contactWhatsapp).trim()
          : null,
        contact_telegram: contactTelegram.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_website:
          normalizedWebsite && isValidWebsiteInput(normalizedWebsite) ? normalizedWebsite : null,
        images: allImages,
        image_hashes: cleanHashes,
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
  const isStep1SoftIncomplete = step === 1 && !rulesAccepted;
  const isStep3SoftIncomplete = step === 3 && activeContacts.length === 0;
  const visibleRules = showAllRules ? fullPolicyRules : compactPolicyRules;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazir"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 dark:!bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Centered Apple-Minimalist Modal Box (NEVER bottom sheet) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-ad-modal-title"
        className="relative w-full max-w-[540px] max-h-[90dvh] flex flex-col bg-[#FBFBFC] rounded-[24px] sm:rounded-[28px] border border-[#ECEFF4] shadow-[0_24px_70px_rgba(29,29,31,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden z-10"
      >
        {/* Unified Calm Header + Slim 4-Segment Progress Bar */}
        <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-[#ECEFF4] bg-[#FBFBFC] space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF2FB] text-[#0066CC] shrink-0">
                <PlusCircle className="w-[19px] h-[19px] block shrink-0" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2
                  id="post-ad-modal-title"
                  className="text-[15px] sm:text-base font-extrabold text-[#1D1D1F] leading-snug truncate"
                >
                  ثبت آگهی رایگان
                </h2>
                <p className="text-[11px] text-[#6E6E73] leading-snug truncate">
                  {successData ? 'آگهی شما ثبت شد' : activeStepMeta.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] dark:hover:!bg-white/[0.10] active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            >
              <X className="w-[18px] h-[18px] block shrink-0" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {/* Slim 4-Segment Progress Bar */}
          {!successData && (
            <div className="grid grid-cols-4 gap-1.5" role="list" aria-label="مراحل ثبت آگهی">
              {WIZARD_STEPS.map((s) => {
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={!isDone}
                    onClick={() => isDone && goToStep(s.num)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex flex-col gap-1.5 text-right transition-opacity ${
                      isDone ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`block h-1 w-full rounded-full transition-colors duration-200 ${
                        isCurrent || isDone
                          ? 'bg-[#0066CC]'
                          : 'bg-[#ECECEF] dark:!bg-white/[0.10]'
                      }`}
                    />
                    <span
                      className={`inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] leading-none truncate ${
                        isCurrent
                          ? 'font-extrabold text-[#0066CC]'
                          : isDone
                            ? 'font-bold text-[#1D1D1F]'
                            : 'font-medium text-[#86868B]'
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-2.5 h-2.5 block shrink-0 text-[#0066CC]" strokeWidth={3} aria-hidden="true" />
                      ) : (
                        <span className="tabular-nums opacity-75">{s.num.toLocaleString('fa-IR')}.</span>
                      )}
                      <span className="leading-none truncate">{s.shortLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Body & Recessed Sticky Footer */}
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
              /* ======================================================
                 SUCCESS SCREEN
              ====================================================== */
              <div className="py-3 text-center space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="w-7 h-7 block shrink-0" strokeWidth={2.5} aria-hidden="true" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1D1D1F]">
                    {successData.ad?.status === 'active'
                      ? 'آگهی شما با موفقیت منتشر شد'
                      : 'آگهی شما ثبت شد و پس از بررسی منتشر می‌شود'}
                  </h3>
                  <p className="text-xs text-[#6E6E73] max-w-sm mx-auto leading-relaxed">
                    {successData.duplicateReviewFlagged
                      ? 'آگهی شما برای بررسی به مدیر ارسال شد و پس از تایید منتشر می‌شود.'
                      : currentT.saveYourCredentials}
                  </p>
                </div>

                <div className="max-w-md mx-auto rounded-2xl bg-[#F5F5F7] border border-[#ECEFF4] divide-y divide-[#ECEFF4] overflow-hidden text-right">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10px] font-bold text-[#86868B]">
                        {currentT.referenceNo}
                      </span>
                      <span className="font-mono text-base font-black text-[#1D1D1F]">
                        <bdi dir="ltr">{successData.referenceNumber}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.referenceNumber, 'ref')}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#FFFFFF] dark:bg-[#1C1F28] hover:bg-[#ECECEF] dark:hover:!bg-white/[0.12] border border-[#ECEFF4] dark:!border-white/[0.10] text-[#1D1D1F] text-xs font-bold leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedRef ? (
                        <Check className="w-3.5 h-3.5 block shrink-0 text-emerald-500" strokeWidth={2.5} aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 block shrink-0" strokeWidth={2} aria-hidden="true" />
                      )}
                      <span className="leading-none">
                        {copiedRef ? currentT.copied : currentT.copyRef}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10px] font-bold text-[#86868B]">
                        {currentT.pinCode}
                      </span>
                      <span className="font-mono text-base font-black text-amber-600">
                        <bdi dir="ltr">{successData.pinCode}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.pinCode, 'pin')}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#FFFFFF] dark:bg-[#1C1F28] hover:bg-[#ECECEF] dark:hover:!bg-white/[0.12] border border-[#ECEFF4] dark:!border-white/[0.10] text-[#1D1D1F] text-xs font-bold leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedPin ? (
                        <Check className="w-3.5 h-3.5 block shrink-0 text-emerald-500" strokeWidth={2.5} aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 block shrink-0" strokeWidth={2} aria-hidden="true" />
                      )}
                      <span className="leading-none">
                        {copiedPin ? currentT.copied : currentT.copyPin}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] px-4 py-3 leading-relaxed">
                    <KeyRound className="w-3.5 h-3.5 block shrink-0 text-[#86868B]" strokeWidth={2} aria-hidden="true" />
                    <span>
                      این کدها در همین مرورگر ذخیره شدند؛ برای مدیریت از دستگاه دیگر، آن‌ها را کپی کنید.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2.5 flex-wrap">
                  {successData.wantVip && onProceedToVip && (
                    <button
                      type="button"
                      onClick={() => onProceedToVip(successData.ad)}
                      className="min-h-[44px] h-11 px-6 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] font-bold text-xs inline-flex items-center gap-1.5 leading-none shadow-[0_4px_14px_rgba(0,102,204,0.22)] active:scale-95 transition-all cursor-pointer"
                    >
                      <Crown className="w-4 h-4 block shrink-0" strokeWidth={2} aria-hidden="true" />
                      <span className="leading-none">ادامه و پرداخت آگهی ویژه ({vipPriceLabel})</span>
                    </button>
                  )}

                  {onOpenManageExisting && !successData.wantVip && (
                    <button
                      type="button"
                      onClick={() => onOpenManageExisting(successData.referenceNumber)}
                      className="min-h-[44px] h-11 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] text-[#1D1D1F] font-bold text-xs inline-flex items-center gap-1.5 leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 block shrink-0" strokeWidth={2} aria-hidden="true" />
                      <span className="leading-none">مدیریت آگهی</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className={`min-h-[44px] h-11 px-6 rounded-full font-bold text-xs leading-none active:scale-95 transition-all cursor-pointer ${
                      successData.wantVip
                        ? 'bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] text-[#1D1D1F]'
                        : 'bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC]'
                    }`}
                  >
                    {currentT.close}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Inline Error Banner */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 dark:!border-rose-500/35 px-3.5 py-3 text-xs text-rose-700 font-semibold"
                  >
                    <AlertCircle className="w-4 h-4 block shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span className="leading-relaxed">{errorMsg}</span>
                  </div>
                )}

                {/* Duplicate Ad Warning (Step 4) */}
                {duplicateWarning && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-300 dark:!border-amber-500/40 bg-amber-50 p-4 space-y-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <CopyCheck className="w-4 h-4 block text-amber-700 shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-[13px] font-black text-amber-950 dark:text-amber-200">
                            آگهی مشابه یا تکراری شناسایی شد
                          </h4>
                          {Number(duplicateWarning.score) > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:!bg-amber-500/25 text-amber-950 dark:text-amber-200 text-[10.5px] font-extrabold tabular-nums">
                              تشابه {Math.round(duplicateWarning.score * 100).toLocaleString('fa-IR')}٪
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-amber-900 dark:text-amber-300/90 leading-relaxed">
                          {duplicateWarning.message}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#1C1F28] border border-amber-200/80 dark:!border-white/[0.08] p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-[#1D1D1F] truncate">
                          {duplicateWarning.title}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#0066CC] bg-[#EAF2FB] px-2 py-0.5 rounded-md">
                          <bdi dir="ltr">{duplicateWarning.reference_number}</bdi>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#6E6E73]">
                        <span>{duplicateWarning.city}</span>
                        <span>•</span>
                        <span>
                          {duplicateWarning.status === 'active' ? 'منتشرشده' : 'در انتظار تایید'}
                        </span>
                      </div>
                      {Array.isArray(duplicateWarning.reasons) &&
                        duplicateWarning.reasons.length > 0 && (
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
                        onClick={() => onOpenManageExisting?.(duplicateWarning.reference_number)}
                        className="flex-1 min-h-[40px] px-3 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] text-xs font-bold leading-none inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 block shrink-0" strokeWidth={2} aria-hidden="true" />
                        <span className="leading-none">ویرایش یا بوست رایگان آگهی قبلی</span>
                      </button>
                      {duplicateWarning.status === 'active' && (
                        <a
                          href={`/?ad=${encodeURIComponent(duplicateWarning.reference_number)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] px-3.5 rounded-full bg-[#FFFFFF] dark:bg-[#1C1F28] border border-amber-300 dark:!border-amber-500/35 text-amber-950 dark:text-amber-200 text-xs font-bold leading-none inline-flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 block shrink-0" strokeWidth={2} aria-hidden="true" />
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
                    STEP 1 — اطلاعات امنیتی (Security, Privacy & Rules)
                ====================================================== */}
                {step === 1 && (
                  <div className="space-y-3.5">
                    {/* Zone 1: Privacy & Security Assurance */}
                    <div className="rounded-2xl border border-[#ECEFF4] bg-[#FFFFFF] dark:bg-[#1C1F28] p-4 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF2FB] text-[#0066CC] shrink-0">
                          <ShieldCheck className="w-4 h-4 block shrink-0" strokeWidth={2} aria-hidden="true" />
                        </div>
                        <h3 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] leading-none">
                          حریم خصوصی و امنیت آگهی شما
                        </h3>
                      </div>

                      <ul className="space-y-2 text-[11.5px] text-[#515154] leading-relaxed">
                        <li className="flex items-start gap-2">
                          <KeyRound className="w-3.5 h-3.5 block shrink-0 text-[#0066CC] mt-0.5" strokeWidth={2} aria-hidden="true" />
                          <span>بدون نیاز به ثبت‌نام؛ پس از ثبت آگهی، کد پیگیری و کد امنیتی مدیریت اختصاصی به شما نمایش داده می‌شود.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="w-3.5 h-3.5 block shrink-0 text-[#0066CC] mt-0.5" strokeWidth={2} aria-hidden="true" />
                          <span>شماره تلفن اختیاری است؛ راه‌های تماس پشت تایید امنیتی محافظت شده و در گوگل ثبت نمی‌شوند.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 block shrink-0 text-[#0066CC] mt-0.5" strokeWidth={2} aria-hidden="true" />
                          <span>تایید ضدربات کلودفلر دقیقاً در مرحله آخر پیش از انتشار آگهی انجام می‌شود.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Zone 2: Publishing Rules + Tactile Acceptance Checkbox */}
                    <div
                      className={`rounded-2xl border overflow-hidden divide-y divide-[#F0F2F5] transition-colors ${
                        rulesHighlightError
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-[#ECEFF4] bg-[#FFFFFF] dark:bg-[#1C1F28]'
                      }`}
                    >
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-[#1D1D1F] leading-none">
                            قوانین انتشار آگهی
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAllRules((v) => !v)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold leading-none text-[#0066CC] cursor-pointer"
                          >
                            <span className="leading-none">
                              {showAllRules ? 'نمای خلاصه' : 'مشاهده کامل'}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 block shrink-0 transition-transform ${
                                showAllRules ? 'rotate-180' : ''
                              }`}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        <ul className="space-y-1.5 text-[11.5px] text-[#515154] leading-relaxed list-disc ps-4">
                          {visibleRules.map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      </div>

                      <label className="flex items-center gap-3 min-h-[48px] px-4 py-3 bg-[#F5F5F7]/75 cursor-pointer select-none">
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
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors shrink-0 ${
                            rulesAccepted
                              ? 'bg-[#0066CC] border-[#0066CC] text-white'
                              : rulesHighlightError
                                ? 'bg-[#FFFFFF] dark:bg-[#1C1F28] border-rose-400'
                                : 'bg-[#FFFFFF] dark:bg-[#1C1F28] border-[#C7C7CC] dark:!border-white/30'
                          }`}
                        >
                          {rulesAccepted && (
                            <Check className="w-3 h-3 block" strokeWidth={3} aria-hidden="true" />
                          )}
                        </span>
                        <span className="text-xs font-bold leading-snug text-[#1D1D1F]">
                          قوانین انتشار آگهی را خواندم و می‌پذیرم <span className="text-rose-500">*</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 2 — نوع و اطلاعات تبلیغ (Ad Type & Core Info)
                ====================================================== */}
                {step === 2 && (
                  <div className="space-y-4">
                    {/* Symmetrical 3×3 Category Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-extrabold text-[#1D1D1F]">
                        نوع تبلیغ (دسته‌بندی) <span className="text-rose-500">*</span>
                      </label>
                      <div
                        role="radiogroup"
                        aria-label="نوع تبلیغ"
                        className="grid grid-cols-3 gap-1.5 sm:gap-2"
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
                              className={`min-h-[44px] sm:min-h-[40px] px-2.5 rounded-xl border inline-flex items-center justify-center sm:justify-start gap-1.5 text-[11.5px] sm:text-xs font-bold leading-none transition-all duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] ${
                                isSelected
                                  ? 'bg-[#EAF2FB] border-[#0066CC] dark:!border-[#3B9BFF] text-[#0066CC] shadow-[0_0_0_1px_rgba(0,102,204,0.35)]'
                                  : 'bg-[#FFFFFF] dark:bg-[#1C1F28] border-[#ECEFF4] dark:!border-white/[0.10] text-[#515154] hover:bg-[#F5F5F7] dark:hover:!bg-white/[0.06] hover:text-[#1D1D1F]'
                              }`}
                            >
                              <CatIcon
                                className={`w-3.5 h-3.5 block shrink-0 ${
                                  isSelected ? 'text-[#0066CC]' : 'text-[#86868B]'
                                }`}
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              <span className="leading-none truncate">{c.fa}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="post-ad-title"
                          className="text-xs font-extrabold text-[#1D1D1F]"
                        >
                          عنوان آگهی <span className="text-rose-500">*</span>
                        </label>
                        {title.length > 60 && (
                          <span className="text-[10.5px] font-medium text-[#86868B] tabular-nums">
                            {title.length.toLocaleString('fa-IR')} / ۱۰۰
                          </span>
                        )}
                      </div>
                      <input
                        id="post-ad-title"
                        type="text"
                        required
                        maxLength={100}
                        placeholder="مثال: اجاره آپارتمان ۲ خوابه در استکهلم"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    {/* Description (Preserves link filter) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="post-ad-description"
                          className="text-xs font-extrabold text-[#1D1D1F]"
                        >
                          توضیحات آگهی <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10.5px] text-[#86868B]">بدون درج لینک</span>
                      </div>
                      <textarea
                        id="post-ad-description"
                        required
                        rows={4}
                        placeholder="مشخصات اصلی، شرایط، ساعات کاری یا جزئیات مهم را کوتاه و شفاف بنویسید..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full rounded-xl border bg-[#FFFFFF] dark:bg-[#1C1F28] px-3.5 py-3 text-xs sm:text-[13px] font-medium text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:ring-2 transition-colors resize-none leading-relaxed ${
                          descriptionHasLink
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-[#ECEFF4] dark:!border-white/[0.12] focus:border-[#0066CC] dark:focus:!border-[#3B9BFF] focus:ring-[#0066CC]/15'
                        }`}
                      />
                      {descriptionHasLink && (
                        <p
                          role="alert"
                          className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5"
                        >
                          <AlertCircle className="w-3.5 h-3.5 block shrink-0" strokeWidth={2} aria-hidden="true" />
                          <span>{DESCRIPTION_LINK_ERROR_MSG}</span>
                        </p>
                      )}
                    </div>

                    {/* Always-Visible Optional Price + Negotiable Pill (No Collapsible Drawer!) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="post-ad-price"
                          className="text-xs font-extrabold text-[#1D1D1F]"
                        >
                          قیمت <span className="font-medium text-[#86868B]">(اختیاری)</span>
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
                          className={`min-h-[30px] px-3 rounded-full border text-[11px] font-bold leading-none inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                            priceNegotiable
                              ? 'bg-[#EAF2FB] border-[#0066CC] dark:!border-[#3B9BFF] text-[#0066CC]'
                              : 'bg-[#F5F5F7] border-[#ECEFF4] text-[#6E6E73] hover:text-[#1D1D1F]'
                          }`}
                        >
                          {priceNegotiable && (
                            <Check className="w-3 h-3 block shrink-0" strokeWidth={2.75} aria-hidden="true" />
                          )}
                          <span className="leading-none">توافقی</span>
                        </button>
                      </div>

                      <div className="relative flex items-center">
                        <input
                          id="post-ad-price"
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          disabled={priceNegotiable}
                          placeholder={priceNegotiable ? 'توافقی' : 'مثال: 12000'}
                          value={priceNegotiable ? '' : price}
                          onChange={(e) => setPrice(e.target.value)}
                          className={`${INPUT_CLASS} pe-20 disabled:opacity-60 disabled:cursor-not-allowed`}
                        />
                        <button
                          type="button"
                          onClick={() => setPriceType((cur) => (cur === '€' ? 'kr' : '€'))}
                          title="تغییر واحد پول (کرون / یورو)"
                          className="absolute end-1.5 h-8 px-2.5 rounded-lg bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] text-[11px] font-bold text-[#515154] leading-none inline-flex items-center cursor-pointer transition-colors"
                        >
                          {priceType === '€' ? 'یورو (€)' : 'کرون'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 3 — اطلاعات تماس و نقشه گوگل (Contact + Location & Live Google Map)
                ====================================================== */}
                {step === 3 && (
                  <div className="space-y-4">
                    {/* Card 1: Contact Methods (≥1 Required, Phone Optional) */}
                    <div
                      className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-colors ${
                        contactHighlightError && activeContacts.length === 0
                          ? 'border-rose-400 bg-rose-50/35'
                          : 'border-[#ECEFF4] bg-[#FFFFFF] dark:bg-[#1C1F28]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                          <h3 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] leading-none">
                            راه‌های تماس
                          </h3>
                        </div>

                        {activeContacts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-bold leading-none">
                            <Check className="w-3 h-3 block shrink-0" strokeWidth={2.75} aria-hidden="true" />
                            <span className="leading-none">
                              {activeContacts.length.toLocaleString('fa-IR')} روش تماس ثبت شد
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 h-6 rounded-full text-[10.5px] font-bold leading-none ${
                              contactHighlightError
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-[#EAF2FB] text-[#0066CC]'
                            }`}
                          >
                            حداقل ۱ مورد الزامی
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        شماره تلفن کاملاً اختیاری است؛ برای حریم خصوصی بیشتر می‌توانید از نام کاربری تلگرام، واتساپ یا ایمیل استفاده کنید.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Telegram */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <label
                              htmlFor="post-ad-telegram"
                              className="text-[11.5px] font-bold text-[#1D1D1F]"
                            >
                              تلگرام <span className="text-[10.5px] font-medium text-[#0066CC]">(پیشنهادی)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setOpenHelp((h) => (h === 'telegram' ? null : 'telegram'))}
                              className={`relative h-6 px-2 rounded-full inline-flex items-center gap-1 text-[10px] font-bold leading-none transition-colors cursor-pointer before:content-[''] before:absolute before:-inset-2 sm:before:inset-0 ${
                                openHelp === 'telegram'
                                  ? 'bg-[#EAF2FB] text-[#0066CC]'
                                  : 'bg-[#F5F5F7] text-[#6E6E73] hover:text-[#0066CC]'
                              }`}
                            >
                              <HelpCircle className="w-3 h-3 block shrink-0" strokeWidth={2} aria-hidden="true" />
                              <span className="leading-none">راهنما</span>
                            </button>
                          </div>
                          <div className="relative">
                            <Send
                              className="w-3.5 h-3.5 block text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <input
                              id="post-ad-telegram"
                              type="text"
                              dir="ltr"
                              placeholder="@username"
                              value={contactTelegram}
                              onChange={(e) => {
                                setContactTelegram(e.target.value);
                                setContactHighlightError(false);
                              }}
                              className={`${COMPACT_INPUT_CLASS} pl-9 ${isTelegramValid ? 'pr-8' : ''}`}
                            />
                            {isTelegramValid && (
                              <Check
                                className="w-3.5 h-3.5 block text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          {openHelp === 'telegram' && (
                            <p className="rounded-xl bg-[#F5F5F7] border border-[#ECEFF4] px-2.5 py-2 text-[10.5px] text-[#515154] leading-relaxed">
                              در تلگرام به <strong dir="ltr">Settings → Username</strong> بروید و آیدی خود را بسازید یا کپی کنید (شماره شما مخفی می‌ماند).
                            </p>
                          )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                          <label
                            htmlFor="post-ad-email"
                            className="block text-[11.5px] font-bold text-[#1D1D1F] leading-6"
                          >
                            ایمیل <span className="text-[10.5px] font-medium text-[#0066CC]">(پیشنهادی)</span>
                          </label>
                          <div className="relative">
                            <Mail
                              className="w-3.5 h-3.5 block text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <input
                              id="post-ad-email"
                              type="email"
                              dir="ltr"
                              placeholder="name@example.com"
                              value={contactEmail}
                              onChange={(e) => {
                                setContactEmail(e.target.value);
                                setContactHighlightError(false);
                              }}
                              className={`${COMPACT_INPUT_CLASS} pl-9 ${isEmailValid ? 'pr-8' : ''}`}
                            />
                            {isEmailValid && (
                              <Check
                                className="w-3.5 h-3.5 block text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        </div>

                        {/* WhatsApp */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <label
                              htmlFor="post-ad-whatsapp"
                              className="text-[11.5px] font-bold text-[#1D1D1F]"
                            >
                              واتساپ <span className="text-[10.5px] font-medium text-[#86868B]">(اختیاری)</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setOpenHelp((h) => (h === 'whatsapp' ? null : 'whatsapp'))}
                              className={`relative h-6 px-2 rounded-full inline-flex items-center gap-1 text-[10px] font-bold leading-none transition-colors cursor-pointer before:content-[''] before:absolute before:-inset-2 sm:before:inset-0 ${
                                openHelp === 'whatsapp'
                                  ? 'bg-[#EAF2FB] text-[#0066CC]'
                                  : 'bg-[#F5F5F7] text-[#6E6E73] hover:text-[#0066CC]'
                              }`}
                            >
                              <HelpCircle className="w-3 h-3 block shrink-0" strokeWidth={2} aria-hidden="true" />
                              <span className="leading-none">راهنما</span>
                            </button>
                          </div>
                          <div className="relative">
                            <MessageCircle
                              className="w-3.5 h-3.5 block text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <input
                              id="post-ad-whatsapp"
                              type="text"
                              dir="ltr"
                              placeholder="@username یا +46..."
                              value={contactWhatsapp}
                              onChange={(e) => {
                                setContactWhatsapp(e.target.value);
                                setContactHighlightError(false);
                              }}
                              className={`${COMPACT_INPUT_CLASS} pl-9 ${isWhatsappValid ? 'pr-8' : ''}`}
                            />
                            {isWhatsappValid && (
                              <Check
                                className="w-3.5 h-3.5 block text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          {openHelp === 'whatsapp' && (
                            <p className="rounded-xl bg-[#F5F5F7] border border-[#ECEFF4] px-2.5 py-2 text-[10.5px] text-[#515154] leading-relaxed">
                              در واتساپ به <strong dir="ltr">Settings → Profile → Username</strong> بروید یا شماره با کد کشور (مثل <span dir="ltr">+46...</span>) وارد کنید.
                            </p>
                          )}
                        </div>

                        {/* Phone (Optional) */}
                        <div className="space-y-1">
                          <label
                            htmlFor="post-ad-phone"
                            className="block text-[11.5px] font-bold text-[#1D1D1F] leading-6"
                          >
                            شماره تلفن <span className="text-[10.5px] font-medium text-[#86868B]">(اختیاری)</span>
                          </label>
                          <div className="relative">
                            <Phone
                              className="w-3.5 h-3.5 block text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <input
                              id="post-ad-phone"
                              type="tel"
                              dir="ltr"
                              placeholder={phonePlaceholder}
                              value={contactPhone}
                              onChange={(e) => {
                                setContactPhone(e.target.value);
                                setContactHighlightError(false);
                              }}
                              className={`${COMPACT_INPUT_CLASS} pl-9 ${isPhoneValid ? 'pr-8' : ''}`}
                            />
                            {isPhoneValid && (
                              <Check
                                className="w-3.5 h-3.5 block text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        </div>

                        {/* Website (Optional, full width) */}
                        <div className="sm:col-span-2 space-y-1">
                          <label
                            htmlFor="post-ad-website"
                            className="block text-[11.5px] font-bold text-[#1D1D1F]"
                          >
                            وب‌سایت یا صفحه رسمی <span className="text-[10.5px] font-medium text-[#86868B]">(اختیاری)</span>
                          </label>
                          <div className="relative">
                            <Globe
                              className="w-3.5 h-3.5 block text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            <input
                              id="post-ad-website"
                              type="url"
                              dir="ltr"
                              placeholder="https://example.com"
                              value={contactWebsite}
                              onChange={(e) => {
                                setContactWebsite(e.target.value);
                                setContactHighlightError(false);
                              }}
                              className={`${COMPACT_INPUT_CLASS} pl-9 ${isWebsiteValid ? 'pr-8' : ''}`}
                            />
                            {isWebsiteValid && (
                              <Check
                                className="w-3.5 h-3.5 block text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Location & Automatic Free Google Map */}
                    <div className="rounded-2xl border border-[#ECEFF4] bg-[#FFFFFF] dark:bg-[#1C1F28] overflow-hidden">
                      <div className="p-3.5 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                            <h3 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] leading-none">
                              موقعیت مکانی و نقشه گوگل
                            </h3>
                          </div>
                          {googleMapEmbedUrl && (
                            <span className="text-[10.5px] font-bold text-[#0066CC] bg-[#EAF2FB] px-2 py-0.5 rounded-full leading-none">
                              تبدیل خودکار آدرس به نقشه
                            </span>
                          )}
                        </div>

                        {/* Country + City Side-by-Side */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Country Popover */}
                          <div className="space-y-1" ref={countryDropdownRef}>
                            <label className="block text-[11.5px] font-bold text-[#1D1D1F]">
                              کشور <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setCountryDropdownOpen((o) => !o);
                                  setCityDropdownOpen(false);
                                }}
                                aria-expanded={countryDropdownOpen}
                                className="w-full h-11 sm:h-10 rounded-xl border border-[#ECEFF4] dark:!border-white/[0.12] bg-[#FFFFFF] dark:bg-[#1C1F28] px-3 text-xs font-bold text-[#1D1D1F] flex items-center justify-between gap-1.5 hover:border-[#0066CC]/45 transition-colors cursor-pointer"
                              >
                                <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                                  <Globe className="w-3.5 h-3.5 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                                  <span className="truncate">{currentCountryObj.nameFa}</span>
                                </span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 block shrink-0 text-[#86868B] transition-transform ${
                                    countryDropdownOpen ? 'rotate-180' : ''
                                  }`}
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                              </button>

                              {countryDropdownOpen && (
                                <div className="absolute z-30 mt-1.5 inset-x-0 rounded-2xl border border-[#ECEFF4] dark:!border-white/[0.12] bg-[#FFFFFF] dark:bg-[#1C1F28] shadow-xl p-1.5 max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
                                  {activeCountries.map((c) => {
                                    const active = c.id === adCountry;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleSelectCountry(c)}
                                        className={`w-full min-h-[38px] px-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                          active
                                            ? 'bg-[#EAF2FB] text-[#0066CC]'
                                            : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                        }`}
                                      >
                                        <span className="truncate">{c.nameFa}</span>
                                        {active && (
                                          <Check className="w-3.5 h-3.5 block shrink-0" strokeWidth={2.5} aria-hidden="true" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Searchable City Combobox */}
                          <div className="space-y-1" ref={cityDropdownRef}>
                            <label className="block text-[11.5px] font-bold text-[#1D1D1F]">
                              شهر <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setCityDropdownOpen((o) => {
                                    const next = !o;
                                    if (next) {
                                      setCountryDropdownOpen(false);
                                      setTimeout(() => citySearchInputRef.current?.focus(), 40);
                                    }
                                    return next;
                                  });
                                }}
                                aria-expanded={cityDropdownOpen}
                                className="w-full h-11 sm:h-10 rounded-xl border border-[#ECEFF4] dark:!border-white/[0.12] bg-[#FFFFFF] dark:bg-[#1C1F28] px-3 text-xs font-bold text-[#1D1D1F] flex items-center justify-between gap-1.5 hover:border-[#0066CC]/45 transition-colors cursor-pointer"
                              >
                                <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                                  <MapPin className="w-3.5 h-3.5 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                                  <span className="truncate">{currentCityObj?.fa || city || 'انتخاب شهر'}</span>
                                </span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 block shrink-0 text-[#86868B] transition-transform ${
                                    cityDropdownOpen ? 'rotate-180' : ''
                                  }`}
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                              </button>

                              {cityDropdownOpen && (
                                <div className="absolute z-30 mt-1.5 inset-x-0 rounded-2xl border border-[#ECEFF4] dark:!border-white/[0.12] bg-[#FFFFFF] dark:bg-[#1C1F28] shadow-xl overflow-hidden">
                                  <div className="p-2 border-b border-[#F0F2F5]">
                                    <div className="relative">
                                      <Search
                                        className="w-3.5 h-3.5 block text-[#86868B] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                        strokeWidth={2}
                                        aria-hidden="true"
                                      />
                                      <input
                                        ref={citySearchInputRef}
                                        type="text"
                                        value={cityQuery}
                                        onChange={(e) => setCityQuery(e.target.value)}
                                        placeholder="جستجوی شهر..."
                                        className="w-full h-9 rounded-lg bg-[#F5F5F7] border border-[#ECEFF4] ps-8 pe-2.5 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0066CC]"
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                                    {filteredCities.length > 0 ? (
                                      filteredCities.map((ct) => {
                                        const active = ct.id === city;
                                        return (
                                          <button
                                            key={ct.id}
                                            type="button"
                                            onClick={() => handleSelectCity(ct.id)}
                                            className={`w-full min-h-[36px] px-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                              active
                                                ? 'bg-[#EAF2FB] text-[#0066CC]'
                                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                            }`}
                                          >
                                            <span className="truncate">{ct.fa}</span>
                                            {active && (
                                              <Check className="w-3.5 h-3.5 block shrink-0" strokeWidth={2.5} aria-hidden="true" />
                                            )}
                                          </button>
                                        );
                                      })
                                    ) : (
                                      <p className="py-3 text-center text-[11px] text-[#86868B]">
                                        شهری یافت نشد
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Address / Neighborhood Input */}
                        <div className="space-y-1">
                          <label
                            htmlFor="post-ad-area"
                            className="block text-[11.5px] font-bold text-[#1D1D1F]"
                          >
                            محله یا آدرس{' '}
                            <span className="text-[10.5px] font-medium text-[#86868B]">(اختیاری)</span>
                          </label>
                          <input
                            id="post-ad-area"
                            type="text"
                            maxLength={140}
                            placeholder="مثال: Södermalm یا نام خیابان / محله"
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            className={COMPACT_INPUT_CLASS}
                          />
                          <p className="text-[10.5px] text-[#6E6E73] leading-relaxed">
                            برای آگهی شخصی نیازی به پلاک دقیق منزل نیست؛ نوشتن نام محله کافی است. آدرس شما به‌صورت خودکار در صفحه آگهی روی نقشه گوگل نمایش داده می‌شود.
                          </p>
                        </div>
                      </div>

                      {/* Automatic Live Google Map Preview */}
                      {googleMapEmbedUrl && (
                        <div className="border-t border-[#ECEFF4]">
                          <GoogleMapEmbed
                            embedUrl={googleMapEmbedUrl}
                            title={`پیش‌نمایش نقشه ${googleMapQuery}`}
                            heightClass="h-[176px] sm:h-[196px]"
                            deferForLcp={false}
                            mobileScrollGuard={false}
                          />
                          <div className="px-3.5 py-2.5 bg-[#F5F5F7] border-t border-[#ECEFF4] flex items-center justify-between gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#515154] min-w-0 truncate">
                              <MapPin className="w-3.5 h-3.5 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                              <span className="truncate">
                                {currentCountryObj.nameFa}، {currentCityObj?.fa || city}
                                {area.trim() ? ` — ${area.trim()}` : ''}
                              </span>
                            </span>

                            {googleMapSearchUrl && (
                              <a
                                href={googleMapSearchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-[#EAF2FB] text-[#0066CC] text-[10.5px] font-bold leading-none shrink-0 hover:opacity-85 transition-opacity"
                              >
                                <span className="leading-none">باز کردن در گوگل مپ</span>
                                <ExternalLink className="w-3 h-3 block shrink-0" strokeWidth={2.2} aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 4 — تصاویر (آپلود یا لینک مستقیم) + پیشنهاد VIP + انتشار
                ====================================================== */}
                {step === 4 && (
                  <div className="space-y-4">
                    {/* Card 1: Always-Visible Photo Card (Upload OR Direct Link) */}
                    <div className="rounded-2xl border border-[#ECEFF4] bg-[#FFFFFF] dark:bg-[#1C1F28] p-3.5 sm:p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ImagePlus className="w-4 h-4 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                          <h3 className="text-xs sm:text-[13px] font-extrabold text-[#1D1D1F] leading-none">
                            تصاویر آگهی <span className="font-medium text-[#86868B]">(اختیاری)</span>
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] text-[10.5px] font-bold tabular-nums leading-none">
                          {imagesList.length.toLocaleString('fa-IR')} از ۴
                        </span>
                      </div>

                      {/* Segmented Pill Switcher: Upload vs Direct Link */}
                      <div
                        role="tablist"
                        aria-label="روش افزودن تصویر"
                        className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#F5F5F7] border border-[#ECEFF4]"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={photoInputMode === 'upload'}
                          onClick={() => setPhotoInputMode('upload')}
                          className={`min-h-[40px] sm:min-h-[36px] px-3 rounded-full inline-flex items-center justify-center gap-1.5 text-xs leading-none transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                            photoInputMode === 'upload'
                              ? 'bg-[#FFFFFF] dark:bg-[#1C1F28] text-[#1D1D1F] border border-[#ECEFF4] dark:!border-white/[0.12] shadow-xs font-extrabold'
                              : 'bg-transparent border border-transparent text-[#6E6E73] hover:text-[#1D1D1F] font-semibold'
                          }`}
                        >
                          <Upload
                            className={`w-3.5 h-3.5 block shrink-0 ${
                              photoInputMode === 'upload' ? 'text-[#0066CC]' : 'text-[#86868B]'
                            }`}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          <span className="leading-none">آپلود از دستگاه</span>
                        </button>

                        <button
                          type="button"
                          role="tab"
                          aria-selected={photoInputMode === 'link'}
                          onClick={() => setPhotoInputMode('link')}
                          className={`min-h-[40px] sm:min-h-[36px] px-3 rounded-full inline-flex items-center justify-center gap-1.5 text-xs leading-none transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                            photoInputMode === 'link'
                              ? 'bg-[#FFFFFF] dark:bg-[#1C1F28] text-[#1D1D1F] border border-[#ECEFF4] dark:!border-white/[0.12] shadow-xs font-extrabold'
                              : 'bg-transparent border border-transparent text-[#6E6E73] hover:text-[#1D1D1F] font-semibold'
                          }`}
                        >
                          <Link2
                            className={`w-3.5 h-3.5 block shrink-0 ${
                              photoInputMode === 'link' ? 'text-[#0066CC]' : 'text-[#86868B]'
                            }`}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          <span className="leading-none">لینک مستقیم تصویر</span>
                        </button>
                      </div>

                      {/* Tab Panel 1: Upload Dropzone */}
                      {photoInputMode === 'upload' && (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!uploadingPhotos && imagesList.length < MAX_PHOTOS) {
                              setDragOverUpload(true);
                            }
                          }}
                          onDragLeave={() => setDragOverUpload(false)}
                          onDrop={handleDropPhotos}
                          onClick={() => {
                            if (!uploadingPhotos && imagesList.length < MAX_PHOTOS) {
                              fileInputRef.current?.click();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !uploadingPhotos && imagesList.length < MAX_PHOTOS) {
                              e.preventDefault();
                              fileInputRef.current?.click();
                            }
                          }}
                          className={`rounded-2xl border border-dashed p-4 text-center transition-all ${
                            imagesList.length >= MAX_PHOTOS
                              ? 'border-[#ECEFF4] bg-[#F5F5F7]/60 opacity-60 cursor-not-allowed'
                              : dragOverUpload
                                ? 'border-[#0066CC] bg-[#EAF2FB]/60 cursor-pointer'
                                : 'border-[#C7C7CC] dark:!border-white/[0.20] bg-[#F5F5F7]/60 hover:border-[#0066CC] hover:bg-[#EAF2FB]/35 cursor-pointer'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileUpload}
                            disabled={uploadingPhotos || imagesList.length >= MAX_PHOTOS}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF] dark:bg-[#1C1F28] border border-[#ECEFF4] text-[#0066CC]">
                              {uploadingPhotos ? (
                                <Loader2 className="w-5 h-5 block animate-spin" strokeWidth={2} aria-hidden="true" />
                              ) : (
                                <ImagePlus className="w-5 h-5 block" strokeWidth={1.9} aria-hidden="true" />
                              )}
                            </div>
                            <span className="text-xs font-bold text-[#1D1D1F]">
                              {uploadingPhotos
                                ? 'در حال فشرده‌سازی و ارسال...'
                                : imagesList.length >= MAX_PHOTOS
                                  ? 'ظرفیت ۴ تصویر تکمیل است'
                                  : 'انتخاب عکس از گالری یا کشیدن و رها کردن'}
                            </span>
                            <span className="text-[10.5px] text-[#6E6E73]">
                              حداکثر ۴ تصویر • JPG، PNG، WebP • بهینه‌سازی خودکار تا ۱ مگابایت
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Tab Panel 2: Direct Image Link */}
                      {photoInputMode === 'link' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              dir="ltr"
                              disabled={imagesList.length >= MAX_PHOTOS}
                              placeholder="https://example.com/photo.jpg"
                              value={imageUrl}
                              onChange={(e) => setImageUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addImageByUrl();
                                }
                              }}
                              className={`${COMPACT_INPUT_CLASS} flex-1`}
                            />
                            <button
                              type="button"
                              disabled={!imageUrl.trim() || imagesList.length >= MAX_PHOTOS}
                              onClick={addImageByUrl}
                              className="min-h-[44px] sm:min-h-[40px] px-3.5 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-45 disabled:pointer-events-none text-[#FBFBFC] text-xs font-bold leading-none inline-flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5 block shrink-0" strokeWidth={2.4} aria-hidden="true" />
                              <span className="leading-none">افزودن</span>
                            </button>
                          </div>
                          <p className="text-[10.5px] text-[#6E6E73]">
                            لینک مستقیم تصویر با <span dir="ltr">https://</span> وارد کرده و روی افزودن بزنید.
                          </p>
                        </div>
                      )}

                      {/* Uploaded / Linked Photos Preview Grid */}
                      {imagesList.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-4 gap-2">
                            {imagesList.map((img, idx) => (
                              <div
                                key={`${img}-${idx}`}
                                className="relative aspect-square rounded-xl overflow-hidden bg-[#F5F5F7] border border-[#ECEFF4] group"
                              >
                                <img
                                  src={img}
                                  alt={`تصویر ${idx + 1}`}
                                  onClick={() => idx > 0 && makePrimaryImage(idx)}
                                  title={idx === 0 ? 'تصویر اصلی آگهی' : 'کلیک برای انتخاب به‌عنوان تصویر اصلی'}
                                  className={`w-full h-full object-cover ${idx > 0 ? 'cursor-pointer' : ''}`}
                                />
                                {idx === 0 && (
                                  <span className="absolute bottom-1.5 start-1.5 inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-[#1D1D1F]/75 backdrop-blur-xs text-white text-[9.5px] font-bold leading-none">
                                    <Star className="w-2.5 h-2.5 block shrink-0 text-amber-400" fill="currentColor" strokeWidth={2} aria-hidden="true" />
                                    <span className="leading-none">اصلی</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  aria-label="حذف تصویر"
                                  className="absolute top-1.5 end-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1D1D1F]/75 hover:bg-rose-600 text-white backdrop-blur-xs active:scale-90 transition-colors cursor-pointer before:content-[''] before:absolute before:-inset-2 sm:before:inset-0"
                                >
                                  <X className="w-3.5 h-3.5 block shrink-0" strokeWidth={2.5} aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                          {imagesList.length > 1 && (
                            <p className="text-[10.5px] text-[#86868B]">
                              برای تغییر عکس اصلی (کاور)، روی هر تصویر کلیک کنید.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Zone 2: Standard (Free) vs VIP Offer */}
                    {vipEnabled && (
                      <div className="space-y-2">
                        <span className="block text-xs font-extrabold text-[#1D1D1F]">
                          نوع انتشار آگهی
                        </span>
                        <div
                          role="radiogroup"
                          aria-label="نوع انتشار آگهی"
                          className="grid grid-cols-2 gap-2.5"
                        >
                          {/* Standard Free Card */}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={!wantVipPromotion}
                            onClick={() => setWantVipPromotion(false)}
                            className={`min-h-[88px] p-3.5 rounded-2xl border text-right flex flex-col justify-between gap-2 transition-all duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] ${
                              !wantVipPromotion
                                ? 'bg-[#EAF2FB]/70 border-[#0066CC] dark:!border-[#3B9BFF] shadow-[0_0_0_1px_rgba(0,102,204,0.35)]'
                                : 'bg-[#FFFFFF] dark:bg-[#1C1F28] border-[#ECEFF4] dark:!border-white/[0.10] hover:border-[#0066CC]/35'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-extrabold leading-none text-[#1D1D1F]">
                                آگهی عادی
                              </span>
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 transition-colors ${
                                  !wantVipPromotion
                                    ? 'bg-[#0066CC] border-[#0066CC] text-white'
                                    : 'border-[#C7C7CC] dark:!border-white/25'
                                }`}
                              >
                                {!wantVipPromotion && (
                                  <Check className="w-2.5 h-2.5 block" strokeWidth={3} aria-hidden="true" />
                                )}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-xs font-extrabold text-emerald-700 leading-none">
                                رایگان
                              </span>
                              <span className="block text-[10.5px] text-[#6E6E73] leading-snug">
                                انتشار استاندارد + بوست رایگان
                              </span>
                            </div>
                          </button>

                          {/* VIP Offer Card */}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={wantVipPromotion}
                            onClick={() => setWantVipPromotion(true)}
                            className={`min-h-[88px] p-3.5 rounded-2xl border text-right flex flex-col justify-between gap-2 transition-all duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                              wantVipPromotion
                                ? 'bg-amber-50/80 border-amber-500/80 dark:!border-amber-400/70 shadow-[0_0_0_1px_rgba(245,158,11,0.45)]'
                                : 'bg-[#FFFFFF] dark:bg-[#1C1F28] border-[#ECEFF4] dark:!border-white/[0.10] hover:border-amber-300/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold leading-none text-[#1D1D1F]">
                                <Crown className="w-3.5 h-3.5 block shrink-0 text-amber-500" strokeWidth={2.1} aria-hidden="true" />
                                <span className="leading-none">ویژه (VIP)</span>
                              </span>
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 transition-colors ${
                                  wantVipPromotion
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-[#C7C7CC] dark:!border-white/25'
                                }`}
                              >
                                {wantVipPromotion && (
                                  <Check className="w-2.5 h-2.5 block" strokeWidth={3} aria-hidden="true" />
                                )}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 leading-none tabular-nums">
                                  {vipPriceLabel}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-100/90 dark:!bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[9.5px] font-bold leading-none">
                                  ۳× بازدید
                                </span>
                              </div>
                              <span className="block text-[10.5px] text-[#6E6E73] leading-snug">
                                صدر آگهی‌های {currentCountryObj.nameFa}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Zone 3: Compact 3-Row Review Summary */}
                    <div className="rounded-2xl border border-[#ECEFF4] bg-[#F5F5F7] px-3.5 py-1 divide-y divide-[#ECEFF4]/80 text-[11.5px]">
                      <div className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0 truncate text-[#1D1D1F] font-bold">
                          <span>{title.trim()}</span>
                          <span className="text-[#86868B] font-normal"> • {currentCategoryObj?.fa || category}</span>
                          {parsedPricePreview && (
                            <span className="text-[#0066CC] font-bold"> • {parsedPricePreview}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          title="ویرایش اطلاعات آگهی"
                          className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#0066CC] hover:bg-[#ECECEF] transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5 block" strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0 truncate text-[#515154]">
                          <span className="font-semibold text-[#1D1D1F]">
                            {currentCountryObj.nameFa}، {currentCityObj?.fa || city}
                            {area.trim() ? ` (${area.trim()})` : ''}
                          </span>
                          <span className="text-[#86868B]">
                            {' '}• {activeContacts.map((c) => c.label).join('، ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(3)}
                          title="ویرایش تماس و موقعیت"
                          className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#0066CC] hover:bg-[#ECECEF] transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5 block" strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Zone 4: Cloudflare Turnstile Anti-Bot Verification */}
                    {turnstileSettings.enabled !== false &&
                      turnstileSettings.protectPostAd !== false && (
                        <div className="rounded-2xl border border-[#ECEFF4] bg-[#FFFFFF] dark:bg-[#1C1F28] px-3.5 py-3 flex flex-col items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6E6E73] leading-none">
                            <ShieldCheck className="w-3.5 h-3.5 block shrink-0 text-[#0066CC]" strokeWidth={2} aria-hidden="true" />
                            <span className="leading-none">تایید امنیتی پیش از انتشار</span>
                          </span>
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
                )}
              </>
            )}
          </div>

          {/* Recessed Sticky Bottom Action Bar */}
          {!successData && (
            <div className="px-4 sm:px-6 py-3.5 bg-[#F5F5F7] border-t border-[#ECEFF4] flex items-center gap-2.5 shrink-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="min-h-[44px] h-11 px-4 sm:px-5 rounded-full bg-[#FFFFFF] dark:bg-[#1C1F28] hover:bg-[#ECECEF] dark:hover:!bg-white/[0.10] border border-[#ECEFF4] dark:!border-white/[0.12] text-[#1D1D1F] font-bold text-xs sm:text-[13px] leading-none inline-flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.95] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                >
                  <ChevronRight className="w-4 h-4 block shrink-0" strokeWidth={2.25} aria-hidden="true" />
                  <span className="leading-none">مرحله قبل</span>
                </button>
              )}

              {step < 4 ? (
                <button
                  type="submit"
                  disabled={step === 2 && descriptionHasLink}
                  className={`flex-1 min-h-[44px] h-11 px-5 rounded-full text-[#FBFBFC] font-bold text-xs sm:text-[13.5px] leading-none inline-flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] ${
                    isStep1SoftIncomplete || isStep3SoftIncomplete
                      ? 'bg-[#0066CC]/65 hover:bg-[#0066CC]/80'
                      : 'bg-[#0066CC] hover:bg-[#0055AA] shadow-[0_4px_14px_rgba(0,102,204,0.22)]'
                  }`}
                >
                  <span className="leading-none">
                    {step === 1
                      ? 'تایید و ادامه: اطلاعات آگهی'
                      : step === 2
                        ? 'ادامه: تماس و نقشه گوگل'
                        : 'ادامه: تصاویر و پیشنهاد VIP'}
                  </span>
                  <ChevronLeft className="w-4 h-4 block shrink-0" strokeWidth={2.25} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || uploadingPhotos || descriptionHasLink}
                  className="flex-1 min-h-[44px] h-11 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-45 disabled:cursor-not-allowed text-[#FBFBFC] font-bold text-xs sm:text-[13.5px] leading-none inline-flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,102,204,0.22)] transition-all duration-200 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 block shrink-0 animate-spin" strokeWidth={2.25} aria-hidden="true" />
                  ) : wantVipPromotion && vipEnabled ? (
                    <Crown className="w-4 h-4 block shrink-0" strokeWidth={2.1} aria-hidden="true" />
                  ) : (
                    <Check className="w-4 h-4 block shrink-0" strokeWidth={2.5} aria-hidden="true" />
                  )}
                  <span className="leading-none">
                    {loading
                      ? 'در حال انتشار آگهی...'
                      : wantVipPromotion && vipEnabled
                        ? `انتشار و ارتقا به VIP (${vipPriceLabel})`
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
