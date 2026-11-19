import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Copy,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Search,
  ImagePlus,
  Loader2,
  ExternalLink,
  Crown,
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
import { computeClientVipPrice } from '../lib/vipPricing';
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
  { num: 1, label: 'امنیت و قوانین' },
  { num: 2, label: 'اطلاعات آگهی' },
  { num: 3, label: 'تماس و نقشه' },
  { num: 4, label: 'عکس و انتشار' },
];

// Canonical LinkSho form tokens (verified against index.css Light & Dark overrides)
const FIELD_LABEL_ROW = 'h-5 flex items-center justify-between gap-2';
const FIELD_LABEL = 'text-xs font-bold text-[#1D1D1F] leading-none';
const UNIFIED_INPUT =
  'w-full h-11 rounded-xl border border-[#ECEFF4] bg-[#F5F5F7] px-3.5 text-[13px] font-medium text-[#1D1D1F] placeholder:text-[#86868B] transition-colors hover:border-[#D2D2D7] focus:bg-white focus:border-[#0066CC] dark:focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0066CC]/15 focus:outline-none';
const POPOVER_PANEL =
  'absolute z-30 inset-x-0 top-full mt-1.5 rounded-2xl bg-white dark:!bg-[#1B1E27] border border-[#ECEFF4] dark:!border-white/[0.09] shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-1.5';

function dropdownTriggerClass(isOpen) {
  return `w-full h-11 rounded-xl border px-3.5 text-[13px] font-semibold text-[#1D1D1F] flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/20 ${
    isOpen
      ? 'bg-white dark:!bg-[#1B1D24] border-[#0066CC] dark:border-[#0A84FF] ring-2 ring-[#0066CC]/15'
      : 'bg-[#F5F5F7] border-[#ECEFF4] hover:border-[#D2D2D7]'
  }`;
}

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
  const defaultVisibleRules = [
    fullPolicyRules[0],
    fullPolicyRules[2],
    fullPolicyRules[4],
    fullPolicyRules[5],
  ].filter(Boolean);
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

  // 1: Security & Rules | 2: Category & Info | 3: Contact & Google Map | 4: Photos, VIP & Publish
  const [step, setStep] = useState(1);
  const bodyScrollRef = useRef(null);
  const categoryDropdownRef = useRef(null);
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

  // Step 2 — Category (Dropdown) & Core Info
  const [category, setCategory] = useState(initialCategory || 'bostad');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [priceType, setPriceType] = useState(initialCountryObj.currency || 'kr');

  // Step 3 — Contact (≥1 required, phone optional) & Location Dropdowns + Rounded Google Map
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

  // Step 4 — Photos (Upload OR Link) + VIP Offer + Turnstile
  const [photoInputMode, setPhotoInputMode] = useState('upload');
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
  const selectableCategories = useMemo(
    () => CATEGORIES.filter((c) => c.id !== 'all'),
    []
  );
  const currentCategoryObj =
    selectableCategories.find((c) => c.id === category) || selectableCategories[0];
  const descriptionHasLink = containsLinkInDescription(description);
  const phonePlaceholder = COUNTRY_PHONE_PLACEHOLDERS[adCountry] || '+46 70 123 45 67';

  // Debounce area typing (450ms) for smooth Google Map updates
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedArea(area.trim()), 450);
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

  // Authoritative VIP price matching Stripe backend 1-to-1
  const vipPricing = useMemo(
    () =>
      computeClientVipPrice({
        stripeSettings: stripeSettings || {},
        targetCountry: adCountry,
      }),
    [stripeSettings, adCountry]
  );
  const vipCurrencyFa = vipPricing.currency === 'EUR' ? 'یورو' : 'کرون';
  const vipPriceLabel = `${vipPricing.amountMajor.toLocaleString('fa-IR')} ${vipCurrencyFa}`;

  const scrollBodyTop = () => {
    try {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    scrollBodyTop();
  };

  const closeAllDropdowns = () => {
    setCategoryDropdownOpen(false);
    setCountryDropdownOpen(false);
    setCityDropdownOpen(false);
    setCityQuery('');
  };

  // Lock background scroll & handle Escape cleanly
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (categoryDropdownOpen) {
        setCategoryDropdownOpen(false);
        return;
      }
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
  }, [categoryDropdownOpen, countryDropdownOpen, cityDropdownOpen, openHelp, onClose]);

  // Outside click closes any open dropdown popover
  useEffect(() => {
    if (!categoryDropdownOpen && !countryDropdownOpen && !cityDropdownOpen) return undefined;
    const handleOutside = (e) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
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
  }, [categoryDropdownOpen, countryDropdownOpen, cityDropdownOpen]);

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

  // Photos (Step 4)
  const addImageByUrl = () => {
    setErrorMsg('');
    if (imagesList.length >= MAX_PHOTOS) {
      showError('حداکثر ۴ عکس مجاز است.');
      return;
    }
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    if (!isSafeHttpUrl(trimmed)) {
      showError('لینک عکس معتبر نیست (https://).');
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
      showError('حداکثر ۴ عکس مجاز است.');
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      showError(`فقط ${remainingSlots.toLocaleString('fa-IR')} عکس دیگر مجاز است.`);
    }

    setUploadingPhotos(true);
    try {
      const results = await Promise.all(
        filesToUpload.map(async (rawFile) => {
          if (!rawFile.type.startsWith('image/')) {
            throw new Error('فقط فایل تصویری مجاز است.');
          }
          const readyFile = await compressImageForUpload(rawFile, { maxBytes: MAX_FILE_BYTES });
          if (readyFile.size > MAX_FILE_BYTES) {
            throw new Error('حداکثر حجم عکس ۱ مگابایت است.');
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
            throw new Error('آپلود عکس ناموفق بود.');
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
      showError(err.message || 'آپلود عکس انجام نشد.');
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

  const activeContacts = [
    contactTelegram.trim() && { label: 'تلگرام' },
    contactEmail.trim() && { label: 'ایمیل' },
    contactWhatsapp.trim() && { label: 'واتساپ' },
    contactPhone.trim() && { label: 'تلفن' },
    contactWebsite.trim() && { label: 'وب‌سایت' },
  ].filter(Boolean);

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
      showError('ابتدا قوانین را تایید کنید.');
      return false;
    }
    setRulesHighlightError(false);
    return true;
  };

  const validateStep2 = () => {
    if (!category || !title.trim() || !description.trim()) {
      showError('عنوان و توضیحات الزامی است.');
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
      showError('یک راه تماس وارد کنید.');
      return false;
    }
    if (contactTelegram.trim() && !isValidTelegramInput(contactTelegram)) {
      showError('تلگرام معتبر نیست.');
      return false;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      showError('ایمیل معتبر نیست.');
      return false;
    }
    if (contactWhatsapp.trim() && !isValidWhatsAppInput(contactWhatsapp)) {
      showError('واتساپ معتبر نیست.');
      return false;
    }
    if (contactPhone.trim() && normalizeAsciiDigits(contactPhone).replace(/\D/g, '').length < 6) {
      showError('تلفن معتبر نیست.');
      return false;
    }
    if (contactWebsite.trim() && !isValidWebsiteInput(contactWebsite)) {
      showError('وب‌سایت معتبر نیست.');
      return false;
    }
    setContactHighlightError(false);
    if (!adCountry || !city) {
      showError('کشور و شهر را انتخاب کنید.');
      return false;
    }
    return true;
  };

  const goToStep = (targetStep) => {
    setErrorMsg('');
    setOpenHelp(null);
    closeAllDropdowns();
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
    closeAllDropdowns();

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
    closeAllDropdowns();
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
      showError('تا پایان آپلود عکس‌ها صبر کنید.');
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
      showError('تایید امنیتی را انجام دهید.');
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

      const canOfferVipAfterSubmit = Boolean(
        wantVipPromotion &&
          vipEnabled &&
          res.ad?.status === 'active' &&
          !res.duplicateReviewFlagged
      );

      setDuplicateWarning(null);
      setSuccessData({
        referenceNumber: res.reference_number,
        pinCode: res.pin_code,
        ad: res.ad,
        duplicateReviewFlagged: Boolean(res.duplicateReviewFlagged),
        wantVip: canOfferVipAfterSubmit,
      });

      if (onCreated) {
        onCreated(res.ad, canOfferVipAfterSubmit);
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
        showError(err.message || 'ثبت آگهی انجام نشد.');
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

  const isStep1SoftIncomplete = step === 1 && !rulesAccepted;
  const isStep3SoftIncomplete = step === 3 && activeContacts.length === 0;
  const visibleRules = showAllRules ? fullPolicyRules : defaultVisibleRules;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-scrollbar font-vazir"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1D1D1F]/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Centered LinkSho Modal Box (Never a bottom sheet) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-ad-modal-title"
        className="relative w-full max-w-[496px] max-h-[90dvh] flex flex-col bg-[#FBFBFC] rounded-[24px] sm:rounded-[28px] border border-[#ECEFF4] shadow-[0_24px_70px_rgba(29,29,31,0.22)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden z-10"
      >
        {/* Minimal Native Header (Pure Typography, Zero Oversized Icon Box) */}
        <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-3.5 border-b border-[#F0F2F5] bg-[#FBFBFC] space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="post-ad-modal-title"
              className="text-[16px] sm:text-[17px] font-black text-[#1D1D1F] leading-none truncate"
            >
              {successData ? 'آگهی ثبت شد' : 'ثبت آگهی'}
            </h2>

            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#ECECEF] active:scale-95 transition-colors cursor-pointer shrink-0"
            >
              <X size={16} strokeWidth={1.75} className="block" aria-hidden="true" />
            </button>
          </div>

          {/* Slim 4-Segment Progress Bar */}
          {!successData && (
            <div className="grid grid-cols-4 gap-2" role="list" aria-label="مراحل ثبت آگهی">
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
                      className={`block h-[3px] w-full rounded-full transition-colors duration-200 ${
                        isCurrent || isDone ? 'bg-[#0066CC]' : 'bg-[#ECECEF]'
                      }`}
                    />
                    <span
                      className={`text-[11px] leading-none truncate ${
                        isCurrent
                          ? 'font-bold text-[#0066CC]'
                          : isDone
                            ? 'font-semibold text-[#515154]'
                            : 'font-medium text-[#86868B]'
                      }`}
                    >
                      {s.num.toLocaleString('fa-IR')}. {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Flat Form Plane (Zero Visible Scrollbar, Zero Nested Cards) */}
        <form
          id="post-ad-wizard-form"
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            ref={bodyScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain no-scrollbar px-5 sm:px-6 py-4 sm:py-5 space-y-4"
          >
            {successData ? (
              /* ======================================================
                 SUCCESS SCREEN (Ref & Management PIN shown ONLY here)
              ====================================================== */
              <div className="py-2 text-center space-y-5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check size={24} strokeWidth={2.25} className="block" aria-hidden="true" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-[#1D1D1F]">
                    {successData.ad?.status === 'active'
                      ? 'آگهی شما با موفقیت منتشر شد'
                      : 'آگهی ثبت شد و پس از بررسی منتشر می‌شود'}
                  </h3>
                  <p className="text-xs text-[#6E6E73] leading-relaxed">
                    {successData.duplicateReviewFlagged
                      ? 'آگهی شما برای بررسی مدیر ارسال شد و پس از تایید منتشر می‌شود. کدهای زیر را نگه دارید.'
                      : currentT.saveYourCredentials}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F5F5F7] divide-y divide-[#F0F2F5] overflow-hidden text-right">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10.5px] font-semibold text-[#86868B]">
                        {currentT.referenceNo}
                      </span>
                      <span className="font-mono text-base font-black text-[#1D1D1F]">
                        <bdi dir="ltr">{successData.referenceNumber}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.referenceNumber, 'ref')}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#FBFBFC] border border-[#ECEFF4] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedRef ? (
                        <Check size={13} strokeWidth={2.25} className="block shrink-0 text-emerald-600" />
                      ) : (
                        <Copy size={13} strokeWidth={1.75} className="block shrink-0" />
                      )}
                      <span className="leading-none">{copiedRef ? currentT.copied : currentT.copyRef}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <span className="block text-[10.5px] font-semibold text-[#86868B]">
                        {currentT.pinCode} (محرمانه)
                      </span>
                      <span className="font-mono text-base font-black text-[#0066CC]">
                        <bdi dir="ltr">{successData.pinCode}</bdi>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.pinCode, 'pin')}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#FBFBFC] border border-[#ECEFF4] hover:bg-[#ECECEF] text-[#1D1D1F] text-xs font-bold leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedPin ? (
                        <Check size={13} strokeWidth={2.25} className="block shrink-0 text-emerald-600" />
                      ) : (
                        <Copy size={13} strokeWidth={1.75} className="block shrink-0" />
                      )}
                      <span className="leading-none">{copiedPin ? currentT.copied : currentT.copyPin}</span>
                    </button>
                  </div>

                  <p className="px-4 py-3 text-[11.5px] text-[#515154] leading-relaxed">
                    این کدها به‌صورت خودکار در همین مرورگر ذخیره شدند؛ اما حتماً آن‌ها را کپی یا یادداشت کنید تا در صورت پاک شدن حافظه مرورگر یا ورود با دستگاه دیگر، به مدیریت آگهی خود دسترسی داشته باشید.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2.5 flex-wrap">
                  {successData.wantVip && onProceedToVip && (
                    <button
                      type="button"
                      onClick={() => onProceedToVip(successData.ad)}
                      className="h-11 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] font-bold text-xs inline-flex items-center gap-1.5 leading-none shadow-[0_4px_14px_rgba(0,102,204,0.20)] active:scale-95 transition-all cursor-pointer"
                    >
                      <Crown size={14} strokeWidth={1.75} className="block shrink-0" />
                      <span className="leading-none">پرداخت VIP ({vipPriceLabel})</span>
                    </button>
                  )}

                  {onOpenManageExisting && !successData.wantVip && (
                    <button
                      type="button"
                      onClick={() => onOpenManageExisting(successData.referenceNumber)}
                      className="h-11 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] text-[#1D1D1F] font-bold text-xs leading-none active:scale-95 transition-all cursor-pointer"
                    >
                      مدیریت آگهی
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className={`h-11 px-6 rounded-full font-bold text-xs leading-none active:scale-95 transition-all cursor-pointer ${
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
                    className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-semibold"
                  >
                    <AlertCircle size={15} strokeWidth={1.75} className="block shrink-0" aria-hidden="true" />
                    <span className="leading-snug">{errorMsg}</span>
                  </div>
                )}

                {/* Duplicate Ad Warning (Step 4) */}
                {duplicateWarning && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold text-amber-900">
                          آگهی مشابه یافت شد
                        </h4>
                        {Number(duplicateWarning.score) > 0 && (
                          <span className="text-[11px] font-bold text-amber-800 tabular-nums">
                            {Math.round(duplicateWarning.score * 100).toLocaleString('fa-IR')}٪ تشابه
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-amber-800 leading-snug">
                        {duplicateWarning.message}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#FBFBFC] border border-[#ECEFF4] px-3 py-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1D1D1F] truncate">
                          {duplicateWarning.title}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#0066CC]">
                          <bdi dir="ltr">{duplicateWarning.reference_number}</bdi>
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6E6E73]">
                        {duplicateWarning.city} • {duplicateWarning.status === 'active' ? 'فعال' : 'در بررسی'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenManageExisting?.(duplicateWarning.reference_number)}
                        className="flex-1 h-9 px-3 rounded-full bg-[#0066CC] hover:bg-[#0055AA] text-[#FBFBFC] text-xs font-bold leading-none cursor-pointer"
                      >
                        ویرایش یا بوست قبلی
                      </button>
                      {duplicateWarning.status === 'active' && (
                        <a
                          href={`/?ad=${encodeURIComponent(duplicateWarning.reference_number)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3.5 rounded-full bg-[#FBFBFC] border border-[#ECEFF4] text-[#1D1D1F] text-xs font-bold leading-none inline-flex items-center gap-1"
                        >
                          <span>مشاهده</span>
                          <ExternalLink size={12} strokeWidth={1.75} className="block shrink-0" />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => submitAd({ requestDuplicateReview: true })}
                      className="w-full py-1 text-[11px] font-semibold text-amber-900 hover:underline cursor-pointer text-center"
                    >
                      متفاوت است — ارسال برای بررسی
                    </button>
                  </div>
                )}

                {/* ======================================================
                    STEP 1 — امنیت و قوانین (Clear & Self-Explanatory)
                ====================================================== */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2 text-xs text-[#515154] leading-relaxed">
                      <p>
                        <strong className="text-[#1D1D1F]">بدون نیاز به ثبت‌نام:</strong> پس از انتشار آگهی، یک «کد آگهی» و یک «کد مدیریت محرمانه» به شما نمایش داده می‌شود که در مرورگر ذخیره شده و باید آن را یادداشت کنید.
                      </p>
                      <p>
                        <strong className="text-[#1D1D1F]">حفظ حریم خصوصی:</strong> وارد کردن شماره تلفن اختیاری است و راه‌های تماس شما پشت تایید امنیتی محافظت می‌شوند.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#F5F5F7] p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#1D1D1F] leading-none">
                          قوانین انتشار و بوست رایگان
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllRules((v) => !v)}
                          className="text-xs font-semibold text-[#0066CC] leading-none cursor-pointer"
                        >
                          {showAllRules ? 'نمای خلاصه' : 'مشاهده کامل'}
                        </button>
                      </div>

                      <ul className="space-y-2 text-xs text-[#515154] leading-relaxed list-disc ps-4">
                        {visibleRules.map((rule, idx) => (
                          <li key={idx}>{rule}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-[#F0F2F5] pt-3">
                      <label className="min-h-[44px] flex items-center gap-2.5 cursor-pointer select-none">
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
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border transition-colors shrink-0 ${
                            rulesAccepted
                              ? 'bg-[#0066CC] border-[#0066CC] text-white'
                              : rulesHighlightError
                                ? 'bg-rose-50 border-rose-400'
                                : 'bg-[#F5F5F7] border-[#D2D2D7]'
                          }`}
                        >
                          {rulesAccepted && (
                            <Check size={12} strokeWidth={2.75} className="block" aria-hidden="true" />
                          )}
                        </span>
                        <span className="text-xs font-bold text-[#1D1D1F] leading-none">
                          قوانین انتشار و بوست آگهی را خواندم و می‌پذیرم <span className="text-rose-500">*</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 2 — اطلاعات آگهی (Sleek Category Dropdown + Level Inputs)
                ====================================================== */}
                {step === 2 && (
                  <div className="space-y-3.5">
                    {/* Category Dropdown */}
                    <div className="space-y-1.5" ref={categoryDropdownRef}>
                      <div className={FIELD_LABEL_ROW}>
                        <label className={FIELD_LABEL}>
                          دسته‌بندی <span className="text-rose-500">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCategoryDropdownOpen((o) => !o)}
                          aria-expanded={categoryDropdownOpen}
                          className={dropdownTriggerClass(categoryDropdownOpen)}
                        >
                          <span className="leading-none truncate">
                            {currentCategoryObj?.fa || 'انتخاب دسته‌بندی'}
                          </span>
                          <ChevronDown
                            size={15}
                            strokeWidth={1.75}
                            className={`block shrink-0 transition-transform duration-200 ${
                              categoryDropdownOpen ? 'rotate-180 text-[#0066CC]' : 'text-[#86868B]'
                            }`}
                            aria-hidden="true"
                          />
                        </button>

                        {categoryDropdownOpen && (
                          <div className={POPOVER_PANEL} role="listbox" aria-label="دسته‌بندی">
                            <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5">
                              {selectableCategories.map((c) => {
                                const active = c.id === category;
                                const CatIcon = CATEGORY_ICONS[c.id] || Tag;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => {
                                      setCategory(c.id);
                                      setCategoryDropdownOpen(false);
                                    }}
                                    className={`w-full h-9 px-3 rounded-xl text-[12.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                      active
                                        ? 'bg-[#EAF2FB] text-[#0066CC] font-bold'
                                        : 'text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                                    }`}
                                  >
                                    <span className="inline-flex items-center gap-2 min-w-0">
                                      <CatIcon
                                        size={14}
                                        strokeWidth={1.75}
                                        className={`block shrink-0 ${active ? 'text-[#0066CC]' : 'text-[#86868B]'}`}
                                        aria-hidden="true"
                                      />
                                      <span className="leading-none truncate">{c.fa}</span>
                                    </span>
                                    {active && (
                                      <Check size={14} strokeWidth={2.25} className="block shrink-0" aria-hidden="true" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <div className={FIELD_LABEL_ROW}>
                        <label htmlFor="post-ad-title" className={FIELD_LABEL}>
                          عنوان <span className="text-rose-500">*</span>
                        </label>
                        {title.length > 60 && (
                          <span className="text-[11px] text-[#86868B] tabular-nums leading-none">
                            {title.length.toLocaleString('fa-IR')} / ۱۰۰
                          </span>
                        )}
                      </div>
                      <input
                        id="post-ad-title"
                        type="text"
                        required
                        maxLength={100}
                        placeholder="مثلاً: آپارتمان ۲ خوابه"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={UNIFIED_INPUT}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <div className={FIELD_LABEL_ROW}>
                        <label htmlFor="post-ad-description" className={FIELD_LABEL}>
                          توضیحات <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-[#86868B] leading-none">بدون لینک</span>
                      </div>
                      <textarea
                        id="post-ad-description"
                        required
                        rows={4}
                        placeholder="جزئیات آگهی..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full rounded-xl border bg-[#F5F5F7] px-3.5 py-2.5 text-[13px] font-medium text-[#1D1D1F] placeholder:text-[#86868B] focus:bg-white focus:outline-none focus:ring-2 transition-colors resize-none leading-relaxed ${
                          descriptionHasLink
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-[#ECEFF4] hover:border-[#D2D2D7] focus:border-[#0066CC] dark:focus:border-[#0A84FF] focus:ring-[#0066CC]/15'
                        }`}
                      />
                      {descriptionHasLink && (
                        <p
                          role="alert"
                          className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5"
                        >
                          <AlertCircle size={14} strokeWidth={1.75} className="block shrink-0" aria-hidden="true" />
                          <span>{DESCRIPTION_LINK_ERROR_MSG}</span>
                        </p>
                      )}
                    </div>

                    {/* Price + Currency + Negotiable (100% Level h-11 Row) */}
                    <div className="space-y-1.5">
                      <div className={FIELD_LABEL_ROW}>
                        <label htmlFor="post-ad-price" className={FIELD_LABEL}>
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
                          className={`h-6 px-2.5 rounded-full text-[11px] font-bold leading-none transition-colors cursor-pointer ${
                            priceNegotiable
                              ? 'bg-[#EAF2FB] text-[#0066CC]'
                              : 'bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]'
                          }`}
                        >
                          توافقی
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="post-ad-price"
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          disabled={priceNegotiable}
                          placeholder={priceNegotiable ? 'توافقی' : '12000'}
                          value={priceNegotiable ? '' : price}
                          onChange={(e) => setPrice(e.target.value)}
                          className={`${UNIFIED_INPUT} flex-1 disabled:opacity-55 disabled:cursor-not-allowed`}
                        />
                        <button
                          type="button"
                          onClick={() => setPriceType((cur) => (cur === '€' ? 'kr' : '€'))}
                          title="واحد پول"
                          className="h-11 px-4 rounded-xl border border-[#ECEFF4] bg-[#F5F5F7] hover:bg-[#ECECEF] text-[13px] font-bold text-[#1D1D1F] leading-none inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        >
                          {priceType === '€' ? 'یورو' : 'کرون'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 3 — تماس و موقعیت (Flat Hairline-Divided, Level Inputs, Rounded Gallery Map)
                ====================================================== */}
                {step === 3 && (
                  <div className="space-y-4">
                    {/* Section A: Contact */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-[#1D1D1F] leading-none">
                          تماس
                        </h3>
                        <span
                          className={`text-[11px] font-semibold leading-none ${
                            activeContacts.length > 0
                              ? 'text-emerald-600'
                              : contactHighlightError
                                ? 'text-rose-600'
                                : 'text-[#86868B]'
                          }`}
                        >
                          {activeContacts.length > 0
                            ? `${activeContacts.length.toLocaleString('fa-IR')} مورد`
                            : 'حداقل ۱ مورد'}
                        </span>
                      </div>

                      <p className="text-[11.5px] text-[#6E6E73] leading-relaxed">
                        وارد کردن حداقل یک راه تماس الزامی است. شماره تلفن اختیاری است و برای حفظ حریم خصوصی می‌توانید از آیدی تلگرام، واتساپ یا ایمیل استفاده کنید.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Telegram */}
                        <div className="space-y-1.5">
                          <div className={FIELD_LABEL_ROW}>
                            <label htmlFor="post-ad-telegram" className={FIELD_LABEL}>
                              تلگرام
                            </label>
                            <button
                              type="button"
                              onClick={() => setOpenHelp((h) => (h === 'telegram' ? null : 'telegram'))}
                              className="text-[11px] font-semibold text-[#0066CC] leading-none cursor-pointer"
                            >
                              راهنما
                            </button>
                          </div>
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
                            className={UNIFIED_INPUT}
                          />
                          {openHelp === 'telegram' && (
                            <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                              در تلگرام به بخش <span dir="ltr" className="font-semibold">Settings → Username</span> بروید و آیدی خود را بسازید یا کپی کنید (شماره شما نمایش داده نمی‌شود).
                            </p>
                          )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <div className={FIELD_LABEL_ROW}>
                            <label htmlFor="post-ad-email" className={FIELD_LABEL}>
                              ایمیل
                            </label>
                          </div>
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
                            className={UNIFIED_INPUT}
                          />
                        </div>

                        {/* WhatsApp */}
                        <div className="space-y-1.5">
                          <div className={FIELD_LABEL_ROW}>
                            <label htmlFor="post-ad-whatsapp" className={FIELD_LABEL}>
                              واتساپ
                            </label>
                            <button
                              type="button"
                              onClick={() => setOpenHelp((h) => (h === 'whatsapp' ? null : 'whatsapp'))}
                              className="text-[11px] font-semibold text-[#0066CC] leading-none cursor-pointer"
                            >
                              راهنما
                            </button>
                          </div>
                          <input
                            id="post-ad-whatsapp"
                            type="text"
                            dir="ltr"
                            placeholder="+46... / @username"
                            value={contactWhatsapp}
                            onChange={(e) => {
                              setContactWhatsapp(e.target.value);
                              setContactHighlightError(false);
                            }}
                            className={UNIFIED_INPUT}
                          />
                          {openHelp === 'whatsapp' && (
                            <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                              در واتساپ می‌توانید آیدی (<span dir="ltr" className="font-semibold">Settings → Profile → Username</span>) یا شماره با کد کشور مثل <span dir="ltr" className="font-semibold">+46...</span> وارد کنید.
                            </p>
                          )}
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <div className={FIELD_LABEL_ROW}>
                            <label htmlFor="post-ad-phone" className={FIELD_LABEL}>
                              تلفن
                            </label>
                          </div>
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
                            className={UNIFIED_INPUT}
                          />
                        </div>

                        {/* Website */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <div className={FIELD_LABEL_ROW}>
                            <label htmlFor="post-ad-website" className={FIELD_LABEL}>
                              وب‌سایت
                            </label>
                          </div>
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
                            className={UNIFIED_INPUT}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#F0F2F5]" />

                    {/* Section B: Location Dropdowns & Gallery-Style Rounded Map */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold text-[#1D1D1F] leading-none">
                        موقعیت
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Country Dropdown */}
                        <div className="space-y-1.5" ref={countryDropdownRef}>
                          <div className={FIELD_LABEL_ROW}>
                            <label className={FIELD_LABEL}>
                              کشور <span className="text-rose-500">*</span>
                            </label>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setCountryDropdownOpen((o) => !o);
                                setCityDropdownOpen(false);
                              }}
                              aria-expanded={countryDropdownOpen}
                              className={dropdownTriggerClass(countryDropdownOpen)}
                            >
                              <span className="leading-none truncate">{currentCountryObj.nameFa}</span>
                              <ChevronDown
                                size={15}
                                strokeWidth={1.75}
                                className={`block shrink-0 transition-transform duration-200 ${
                                  countryDropdownOpen ? 'rotate-180 text-[#0066CC]' : 'text-[#86868B]'
                                }`}
                                aria-hidden="true"
                              />
                            </button>

                            {countryDropdownOpen && (
                              <div className={POPOVER_PANEL} role="listbox" aria-label="کشور">
                                <div className="max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
                                  {activeCountries.map((c) => {
                                    const active = c.id === adCountry;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        onClick={() => handleSelectCountry(c)}
                                        className={`w-full h-9 px-3 rounded-xl text-[12.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                          active
                                            ? 'bg-[#EAF2FB] text-[#0066CC] font-bold'
                                            : 'text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                                        }`}
                                      >
                                        <span className="leading-none truncate">{c.nameFa}</span>
                                        {active && (
                                          <Check size={14} strokeWidth={2.25} className="block shrink-0" aria-hidden="true" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Searchable City Dropdown (Matches Hero City Popover) */}
                        <div className="space-y-1.5" ref={cityDropdownRef}>
                          <div className={FIELD_LABEL_ROW}>
                            <label className={FIELD_LABEL}>
                              شهر <span className="text-rose-500">*</span>
                            </label>
                          </div>
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
                              className={dropdownTriggerClass(cityDropdownOpen)}
                            >
                              <span className="leading-none truncate">
                                {currentCityObj?.fa || city || 'انتخاب شهر'}
                              </span>
                              <ChevronDown
                                size={15}
                                strokeWidth={1.75}
                                className={`block shrink-0 transition-transform duration-200 ${
                                  cityDropdownOpen ? 'rotate-180 text-[#0066CC]' : 'text-[#86868B]'
                                }`}
                                aria-hidden="true"
                              />
                            </button>

                            {cityDropdownOpen && (
                              <div className={POPOVER_PANEL} role="listbox" aria-label="شهر">
                                {countryCities.length > 5 && (
                                  <div className="pb-1.5 mb-1 border-b border-[#F0F2F5]">
                                    <div className="relative">
                                      <Search
                                        size={14}
                                        strokeWidth={1.75}
                                        className="block text-[#86868B] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                        aria-hidden="true"
                                      />
                                      <input
                                        ref={citySearchInputRef}
                                        type="text"
                                        value={cityQuery}
                                        onChange={(e) => setCityQuery(e.target.value)}
                                        placeholder="جستجو..."
                                        className="w-full h-9 rounded-xl bg-[#F5F5F7] ps-8 pe-3 text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                )}
                                <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                  {filteredCities.length > 0 ? (
                                    filteredCities.map((ct) => {
                                      const active = ct.id === city;
                                      return (
                                        <button
                                          key={ct.id}
                                          type="button"
                                          role="option"
                                          aria-selected={active}
                                          onClick={() => handleSelectCity(ct.id)}
                                          className={`w-full h-9 px-3 rounded-xl text-[12.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                            active
                                              ? 'bg-[#EAF2FB] text-[#0066CC] font-bold'
                                              : 'text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                                          }`}
                                        >
                                          <span className="leading-none truncate">{ct.fa}</span>
                                          <span className="inline-flex items-center gap-1.5 shrink-0">
                                            <span dir="ltr" className="text-[10.5px] text-[#86868B] font-normal">
                                              {ct.id}
                                            </span>
                                            {active && (
                                              <Check size={14} strokeWidth={2.25} className="block shrink-0" aria-hidden="true" />
                                            )}
                                          </span>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <p className="py-3 text-center text-xs text-[#86868B]">
                                      یافت نشد
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Neighborhood / Street */}
                      <div className="space-y-1.5">
                        <div className={FIELD_LABEL_ROW}>
                          <label htmlFor="post-ad-area" className={FIELD_LABEL}>
                            محله یا خیابان
                          </label>
                          <span className="text-[11px] text-[#86868B] leading-none">تبدیل خودکار به نقشه</span>
                        </div>
                        <input
                          id="post-ad-area"
                          type="text"
                          maxLength={140}
                          placeholder="مثال: Södermalm یا نام خیابان"
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className={UNIFIED_INPUT}
                        />
                      </div>

                      {/* Frameless Rounded Gallery Map Preview */}
                      {googleMapEmbedUrl && (
                        <div className="relative rounded-2xl overflow-hidden isolate [transform:translateZ(0)] border border-[#F0F2F5] bg-[#ECECEF]">
                          <GoogleMapEmbed
                            embedUrl={googleMapEmbedUrl}
                            title={`نقشه ${googleMapQuery}`}
                            heightClass="h-[180px] sm:h-[196px]"
                            deferForLcp={false}
                            mobileScrollGuard={false}
                            className="rounded-2xl"
                          />
                          <div className="absolute bottom-2.5 inset-x-2.5 z-20 h-9 px-3 rounded-xl bg-[#FBFBFC]/90 border border-[#ECEFF4]/60 backdrop-blur-md shadow-[0_6px_18px_rgba(15,23,42,0.10)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.45)] flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#1D1D1F] min-w-0 truncate leading-none">
                              <MapPin size={13} strokeWidth={1.75} className="block shrink-0 text-[#0066CC]" aria-hidden="true" />
                              <span className="leading-none truncate">
                                {currentCityObj?.fa || city}
                                {area.trim() ? ` • ${area.trim()}` : ''}
                              </span>
                            </span>

                            {googleMapSearchUrl && (
                              <a
                                href={googleMapSearchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] hover:underline leading-none shrink-0"
                              >
                                <span className="leading-none">گوگل مپ</span>
                                <ExternalLink size={11} strokeWidth={2} className="block shrink-0" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ======================================================
                    STEP 4 — عکس و VIP (Flat Flow, Always-Open Photos, Accurate VIP Price)
                ====================================================== */}
                {step === 4 && (
                  <div className="space-y-4">
                    {/* Photos Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-[#1D1D1F] leading-none">
                          عکس‌ها
                        </h3>
                        <span className="text-[11px] font-semibold text-[#86868B] tabular-nums leading-none">
                          {imagesList.length.toLocaleString('fa-IR')} / ۴
                        </span>
                      </div>

                      {/* Clean Text-Only Segmented Switcher */}
                      <div
                        role="tablist"
                        aria-label="روش افزودن عکس"
                        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F5F5F7]"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={photoInputMode === 'upload'}
                          onClick={() => setPhotoInputMode('upload')}
                          className={`h-9 rounded-lg text-xs leading-none transition-all cursor-pointer ${
                            photoInputMode === 'upload'
                              ? 'bg-white dark:!bg-[#232732] text-[#1D1D1F] shadow-2xs font-bold'
                              : 'text-[#6E6E73] hover:text-[#1D1D1F] font-semibold'
                          }`}
                        >
                          آپلود
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={photoInputMode === 'link'}
                          onClick={() => setPhotoInputMode('link')}
                          className={`h-9 rounded-lg text-xs leading-none transition-all cursor-pointer ${
                            photoInputMode === 'link'
                              ? 'bg-white dark:!bg-[#232732] text-[#1D1D1F] shadow-2xs font-bold'
                              : 'text-[#6E6E73] hover:text-[#1D1D1F] font-semibold'
                          }`}
                        >
                          لینک
                        </button>
                      </div>

                      {/* Upload Dropzone */}
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
                          className={`rounded-2xl border border-dashed py-5 px-4 text-center transition-colors ${
                            imagesList.length >= MAX_PHOTOS
                              ? 'border-[#ECEFF4] bg-[#F5F5F7] opacity-55 cursor-not-allowed'
                              : dragOverUpload
                                ? 'border-[#0066CC] bg-[#EAF2FB] cursor-pointer'
                                : 'border-[#D2D2D7] bg-[#F5F5F7] hover:border-[#0066CC] dark:hover:border-[#0A84FF] cursor-pointer'
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
                            {uploadingPhotos ? (
                              <Loader2 size={20} strokeWidth={1.75} className="block animate-spin text-[#0066CC]" aria-hidden="true" />
                            ) : (
                              <ImagePlus size={20} strokeWidth={1.5} className="block text-[#6E6E73]" aria-hidden="true" />
                            )}
                            <span className="text-xs font-bold text-[#1D1D1F]">
                              {uploadingPhotos
                                ? 'در حال آپلود...'
                                : imagesList.length >= MAX_PHOTOS
                                  ? 'ظرفیت تکمیل شد'
                                  : 'انتخاب عکس'}
                            </span>
                            <span className="text-[11px] text-[#86868B]">تا ۱ مگابایت</span>
                          </div>
                        </div>
                      )}

                      {/* Direct Link Input */}
                      {photoInputMode === 'link' && (
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
                            className={`${UNIFIED_INPUT} flex-1`}
                          />
                          <button
                            type="button"
                            disabled={!imageUrl.trim() || imagesList.length >= MAX_PHOTOS}
                            onClick={addImageByUrl}
                            className="h-11 px-4 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-45 disabled:pointer-events-none text-[#FBFBFC] text-xs font-bold leading-none active:scale-95 transition-all cursor-pointer shrink-0"
                          >
                            افزودن
                          </button>
                        </div>
                      )}

                      {/* 4-Slot Photo Grid */}
                      {imagesList.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {imagesList.map((img, idx) => (
                            <div
                              key={`${img}-${idx}`}
                              className="relative aspect-square rounded-xl overflow-hidden bg-[#ECECEF] border border-[#F0F2F5]"
                            >
                              <img
                                src={img}
                                alt={`عکس ${idx + 1}`}
                                onClick={() => idx > 0 && makePrimaryImage(idx)}
                                title={idx === 0 ? 'اصلی' : 'انتخاب اصلی'}
                                className={`w-full h-full object-cover ${idx > 0 ? 'cursor-pointer' : ''}`}
                              />
                              {idx === 0 && (
                                <span className="absolute bottom-1 start-1 px-1.5 h-4 rounded-full bg-[#1D1D1F]/75 text-white text-[9.5px] font-bold leading-none inline-flex items-center">
                                  اصلی
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                aria-label="حذف عکس"
                                className="absolute top-1 end-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#1D1D1F]/75 hover:bg-rose-600 text-white active:scale-90 transition-colors cursor-pointer before:content-[''] before:absolute before:-inset-2 sm:before:inset-0"
                              >
                                <X size={12} strokeWidth={2.25} className="block" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Standard vs VIP Offer (Clear Explanation of Paid Plan Benefits) */}
                    {vipEnabled && (
                      <>
                        <div className="border-t border-[#F0F2F5]" />
                        <div className="space-y-2">
                          <span className="block text-xs font-extrabold text-[#1D1D1F] leading-none">
                            انتخاب نوع انتشار آگهی
                          </span>
                          <div
                            role="radiogroup"
                            aria-label="نوع انتشار"
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!wantVipPromotion}
                              onClick={() => setWantVipPromotion(false)}
                              className={`p-3.5 rounded-2xl border text-right flex flex-col justify-between gap-2 transition-colors active:scale-[0.98] cursor-pointer ${
                                !wantVipPromotion
                                  ? 'bg-[#EAF2FB] border-[#0066CC] dark:border-[#0A84FF]'
                                  : 'bg-[#F5F5F7] border-[#ECEFF4] hover:border-[#D2D2D7]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-[#1D1D1F] leading-none">
                                  آگهی عادی
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-emerald-700 leading-none">
                                    رایگان
                                  </span>
                                  <span
                                    className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${
                                      !wantVipPromotion
                                        ? 'bg-[#0066CC] border-[#0066CC] text-white'
                                        : 'border-[#D2D2D7]'
                                    }`}
                                  >
                                    {!wantVipPromotion && (
                                      <Check size={10} strokeWidth={3} className="block" aria-hidden="true" />
                                    )}
                                  </span>
                                </span>
                              </div>
                              <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                                نمایش استاندارد در فهرست + امکان بوست رایگان هر ۷ روز یک‌بار
                              </p>
                            </button>

                            <button
                              type="button"
                              role="radio"
                              aria-checked={wantVipPromotion}
                              onClick={() => setWantVipPromotion(true)}
                              className={`p-3.5 rounded-2xl border text-right flex flex-col justify-between gap-2 transition-colors active:scale-[0.98] cursor-pointer ${
                                wantVipPromotion
                                  ? 'bg-amber-50 border-amber-300'
                                  : 'bg-[#F5F5F7] border-[#ECEFF4] hover:border-[#D2D2D7]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1D1D1F] leading-none">
                                  <Crown size={14} strokeWidth={1.75} className="block shrink-0 text-amber-500" aria-hidden="true" />
                                  <span className="leading-none">ویژه (VIP)</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-amber-800 leading-none tabular-nums">
                                    {vipPriceLabel}
                                  </span>
                                  <span
                                    className={`flex h-4 w-4 items-center justify-center rounded-full border shrink-0 ${
                                      wantVipPromotion
                                        ? 'bg-amber-500 border-amber-500 text-white'
                                        : 'border-[#D2D2D7]'
                                    }`}
                                  >
                                    {wantVipPromotion && (
                                      <Check size={10} strokeWidth={3} className="block" aria-hidden="true" />
                                    )}
                                  </span>
                                </span>
                              </div>
                              <p className="text-[11px] text-[#515154] leading-relaxed">
                                نمایش ثابت در صدر فهرست {currentCountryObj.nameFa} به مدت {vipPricing.durationDays.toLocaleString('fa-IR')} روز، ۳ برابر بازدید بیشتر و معاف از حذف خودکار
                              </p>
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Flat 2-Row Summary (No Box Wrapper) */}
                    <div className="border-t border-[#F0F2F5] pt-2 divide-y divide-[#F0F2F5] text-xs">
                      <div className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0 truncate text-[#1D1D1F] font-semibold">
                          <span>{title.trim()}</span>
                          <span className="text-[#86868B] font-normal"> • {currentCategoryObj?.fa || category}</span>
                          {parsedPricePreview && (
                            <span className="text-[#0066CC] font-bold"> • {parsedPricePreview}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="text-[11px] font-semibold text-[#0066CC] hover:underline cursor-pointer shrink-0"
                        >
                          ویرایش
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0 truncate text-[#515154]">
                          <span className="font-semibold text-[#1D1D1F]">
                            {currentCityObj?.fa || city}
                            {area.trim() ? ` (${area.trim()})` : ''}
                          </span>
                          <span className="text-[#86868B]">
                            {' '}• {activeContacts.map((c) => c.label).join('، ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(3)}
                          className="text-[11px] font-semibold text-[#0066CC] hover:underline cursor-pointer shrink-0"
                        >
                          ویرایش
                        </button>
                      </div>
                    </div>

                    {/* Bare Centered Cloudflare Turnstile (No Nested Card) */}
                    {turnstileSettings.enabled !== false &&
                      turnstileSettings.protectPostAd !== false && (
                        <div className="flex justify-center pt-1">
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

          {/* Flat Sticky Bottom Action Bar (100% Level h-11 Buttons) */}
          {!successData && (
            <div className="px-5 sm:px-6 py-3.5 bg-[#FBFBFC] border-t border-[#F0F2F5] flex items-center gap-2.5 shrink-0">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="h-11 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#ECECEF] border border-[#ECEFF4] text-[#1D1D1F] font-bold text-xs leading-none inline-flex items-center justify-center gap-1 transition-colors active:scale-[0.96] cursor-pointer shrink-0"
                >
                  <ChevronRight size={15} strokeWidth={1.75} className="block shrink-0" aria-hidden="true" />
                  <span className="leading-none">قبلی</span>
                </button>
              )}

              {step < 4 ? (
                <button
                  type="submit"
                  disabled={step === 2 && descriptionHasLink}
                  className={`flex-1 h-11 px-5 rounded-full text-[#FBFBFC] font-bold text-[13px] leading-none inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    isStep1SoftIncomplete || isStep3SoftIncomplete
                      ? 'bg-[#0066CC]/65 hover:bg-[#0066CC]/80'
                      : 'bg-[#0066CC] hover:bg-[#0055AA] shadow-[0_4px_14px_rgba(0,102,204,0.20)]'
                  }`}
                >
                  <span className="leading-none">ادامه</span>
                  <ChevronLeft size={15} strokeWidth={1.75} className="block shrink-0" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || uploadingPhotos || descriptionHasLink}
                  className="flex-1 h-11 px-5 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-45 disabled:cursor-not-allowed text-[#FBFBFC] font-bold text-[13px] leading-none inline-flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(0,102,204,0.20)] transition-all active:scale-[0.97] cursor-pointer"
                >
                  {loading && (
                    <Loader2 size={15} strokeWidth={1.75} className="block shrink-0 animate-spin" aria-hidden="true" />
                  )}
                  <span className="leading-none">
                    {loading
                      ? 'در حال انتشار...'
                      : wantVipPromotion && vipEnabled
                        ? `انتشار VIP (${vipPriceLabel})`
                        : 'انتشار آگهی'}
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
