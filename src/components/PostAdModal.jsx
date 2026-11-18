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
  MapPin,
  FileText,
  UserCheck,
  Upload,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import CloudflareTurnstile from './CloudflareTurnstile';
import { supabase, generateReferenceNumber, generatePinCode, isSafeHttpUrl } from '../lib/supabase';
import { publicApi } from '../lib/apiClient';
import { checkProhibitedContent } from '../lib/moderation';
import { COUNTRIES, CATEGORIES, t } from '../lib/translations';

const MAX_PHOTOS = 4;
const MAX_FILE_BYTES = 1048576; // 1 MB

async function compressImageUnder1MB(file) {
  if (file.size <= MAX_FILE_BYTES && ['image/webp', 'image/jpeg', 'image/png', 'image/avif'].includes(file.type)) {
    return file;
  }
  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = imgUrl;
    });
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.85, 0.72, 0.58]) {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
      if (blob && blob.size <= MAX_FILE_BYTES) {
        return new File([blob], `${Date.now()}.webp`, { type: 'image/webp' });
      }
    }
    const fallbackBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.55));
    if (fallbackBlob && fallbackBlob.size <= MAX_FILE_BYTES) {
      return new File([fallbackBlob], `${Date.now()}.jpg`, { type: 'image/jpeg' });
    }
    throw new Error('حجم تصویر حتی پس از فشرده‌سازی بیشتر از ۱ مگابایت است.');
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

export default function PostAdModal({ 
  initialCategory = 'bostad', 
  selectedCountry = 'se',
  countries = COUNTRIES,
  onClose, 
  onCreated 
}) {
  const currentT = t.fa;
  const activeCountries = Array.isArray(countries) && countries.length > 0
    ? countries.filter(c => c.enabled !== false)
    : COUNTRIES;

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Location & Category | 2: Details & Photos | 3: Contact & Publish
  const bodyScrollRef = useRef(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [wantVipPromotion, setWantVipPromotion] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_turnstile_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: true, protectPostAd: true, mode: 'test' };
  });

  // Form fields
  const [adCountry, setAdCountry] = useState(selectedCountry === 'all' ? 'se' : (selectedCountry || 'se'));
  const [category, setCategory] = useState(initialCategory || 'bostad');
  const [city, setCity] = useState(() => {
    const defaultCountry = activeCountries.find(c => c.id === (selectedCountry === 'all' ? 'se' : selectedCountry)) || activeCountries[0];
    return defaultCountry.cities.find(c => c.id !== 'all')?.id || 'Stockholm';
  });
  const [area, setArea] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState(() => {
    const defaultCountry = activeCountries.find(c => c.id === (selectedCountry === 'all' ? 'se' : selectedCountry)) || activeCountries[0];
    return defaultCountry.currency || 'kr';
  });
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactTelegram, setContactTelegram] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [sellerApiUrl, setSellerApiUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagesList, setImagesList] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [pinCode] = useState(generatePinCode);

  const currentCountryObj = activeCountries.find(c => c.id === adCountry) || activeCountries[0];

  // Add image to list (only safe http/https URLs, max 4 photos)
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
      const uploadedUrls = [];
      for (const rawFile of filesToUpload) {
        if (!rawFile.type.startsWith('image/')) {
          throw new Error('فقط فایل‌های تصویری مجاز هستند.');
        }
        const readyFile = await compressImageUnder1MB(rawFile);
        if (readyFile.size > MAX_FILE_BYTES) {
          throw new Error('حجم هر تصویر باید حداکثر ۱ مگابایت باشد.');
        }
        const { uploadUrl, publicUrl } = await publicApi.presignUpload({
          fileName: readyFile.name,
          contentType: readyFile.type,
          fileSize: readyFile.size,
        });
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': readyFile.type },
          body: readyFile,
        });
        if (!putRes.ok) {
          throw new Error('خطا در ارسال تصویر به فضای ابری');
        }
        uploadedUrls.push(publicUrl);
      }
      if (uploadedUrls.length > 0) {
        setImagesList((prev) => [...prev, ...uploadedUrls].slice(0, MAX_PHOTOS));
      }
    } catch (err) {
      setErrorMsg(err.message || 'خطا در آپلود تصویر');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removeImage = (index) => {
    setImagesList(imagesList.filter((_, i) => i !== index));
  };

  const scrollBodyTop = () => {
    try {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!category || !city) {
        setErrorMsg('لطفاً دسته‌بندی و شهر محل آگهی را انتخاب فرمایید.');
        return;
      }
      setStep(2);
      scrollBodyTop();
      return;
    }
    if (step === 2) {
      if (!title.trim() || !description.trim()) {
        setErrorMsg('لطفاً عنوان و توضیحات کامل آگهی را وارد فرمایید.');
        return;
      }
      setStep(3);
      scrollBodyTop();
    }
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    if (step > 1) {
      setStep(step - 1);
      scrollBodyTop();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim() || !description.trim() || !contactName.trim()) {
      setErrorMsg('لطفاً عنوان، توضیحات و نام تماس‌گیرنده را وارد فرمایید.');
      return;
    }

    if (!contactPhone.trim() && !contactWhatsapp.trim() && !contactEmail.trim() && !contactTelegram.trim() && !contactWebsite.trim()) {
      setErrorMsg('حداقل یک راه تماس (شماره تلفن، واتساپ، تلگرام، ایمیل یا وب‌سایت) الزامی است.');
      return;
    }

    const modCheck = checkProhibitedContent({ title, description, area, contactName });
    if (modCheck.blocked) {
      setErrorMsg(modCheck.reason);
      return;
    }

    const turnstileRequired = turnstileSettings.enabled !== false && turnstileSettings.protectPostAd !== false;
    if (turnstileRequired && !turnstileToken) {
      setErrorMsg('لطفاً تایید امنیتی (من ربات نیستم) را کامل کنید.');
      return;
    }

    setLoading(true);

    try {
      const refNum = generateReferenceNumber();
      const finalPin = pinCode.trim() || generatePinCode();

      const allImages = imagesList.filter(isSafeHttpUrl);
      if (imageUrl.trim() && isSafeHttpUrl(imageUrl.trim())) {
        allImages.push(imageUrl.trim());
      }

      const { data, error } = await supabase
        .from('swedpersiska_ads')
        .insert([
          {
            reference_number: refNum,
            pin_code: finalPin,
            title: title.trim(),
            title_fa: title.trim(),
            category,
            country: adCountry,
            city,
            area: area.trim() || null,
            price: price ? parseFloat(price) : null,
            price_type: priceType,
            description: description.trim(),
            contact_name: contactName.trim(),
            contact_phone: contactPhone.trim() || null,
            contact_whatsapp: contactWhatsapp.trim() || null,
            contact_telegram: contactTelegram.trim() || null,
            contact_email: contactEmail.trim() || null,
            contact_website: contactWebsite.trim() || null,
            images: allImages.length > 0 ? allImages : ['https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80'],
            is_featured: false,
            status: 'pending',
            views_count: 1
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Save optional Seller Panel API URL link for this ad
      if (data?.id && sellerApiUrl.trim() && isSafeHttpUrl(sellerApiUrl.trim())) {
        try {
          const { data: linkRow } = await supabase
            .from('swedpersiska_settings')
            .select('value')
            .eq('key', 'ad_seller_links')
            .maybeSingle();
          const prevLinks = (linkRow && linkRow.value && typeof linkRow.value === 'object') ? linkRow.value : {};
          await supabase.from('swedpersiska_settings').upsert({
            key: 'ad_seller_links',
            value: { ...prevLinks, [data.id]: sellerApiUrl.trim().slice(0, 500) },
            updated_at: new Date().toISOString()
          });
        } catch {}
      }

      setSuccessData({
        referenceNumber: refNum,
        pinCode: finalPin,
        ad: data
      });

      if (onCreated) {
        onCreated(data, wantVipPromotion);
      }
    } catch (err) {
      console.error('Error posting ad:', err);
      setErrorMsg(err.message || 'خطا در ثبت آگهی. لطفاً دوباره تلاش فرمایید.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'ref') {
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
      } else {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazir" dir="rtl">
      {/* Blurred Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#6E6E73]">
              <PlusCircle size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {currentT.postAdBtn}
              </h2>
              <span className="text-[11px] font-medium text-slate-500">
                انتشار رایگان در کشورهای حوزه اسکاندیناوی
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 active:scale-95 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3-Step Apple-feel Stepper Header */}
        {!successData && (
          <div className="px-4 sm:px-6 pt-3 pb-3.5 bg-white border-b border-slate-100 shrink-0 space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {[
                { num: 1, label: 'دسته و موقعیت', Icon: MapPin },
                { num: 2, label: 'مشخصات و تصویر', Icon: FileText },
                { num: 3, label: 'تماس و انتشار', Icon: UserCheck },
              ].map((s) => {
                const isDone = step > s.num;
                const isCurrent = step === s.num;
                const StepIcon = s.Icon;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={s.num > step}
                    onClick={() => {
                      if (s.num < step) {
                        setErrorMsg('');
                        setStep(s.num);
                        scrollBodyTop();
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      isCurrent
                        ? 'bg-[#1877F2] text-white shadow-xs'
                        : isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 cursor-pointer active:scale-95'
                          : 'bg-slate-100/80 text-slate-400 cursor-default'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      isCurrent ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isDone ? <Check size={11} strokeWidth={3} /> : <StepIcon size={11} />}
                    </span>
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1877F2] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Form Body or Success Screen */}
        <div ref={bodyScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          
          {successData ? (
            /* Success Screen */
            <div className="py-6 text-center space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73]">
                <Check size={28} strokeWidth={2.5} />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  آگهی شما ثبت شد و در انتظار تایید مدیر است
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  پس از بررسی و تایید توسط مدیریت، آگهی شما در سایت منتشر خواهد شد.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {currentT.saveYourCredentials}
                </p>
              </div>

              {/* Secret Credentials List */}
              <div className="max-w-md mx-auto rounded-2xl bg-[#F5F5F7] divide-y divide-[#E5E5EA] overflow-hidden text-right">
                
                {/* Reference Number */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                      {currentT.referenceNo}
                    </span>
                    <span className="font-mono text-base font-black text-[#1D1D1F] tracking-wider">
                      <bdi>{successData.referenceNumber}</bdi>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(successData.referenceNumber, 'ref')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FBFBFC] hover:bg-white text-[#1D1D1F] text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  >
                    {copiedRef ? <Check size={13} className="text-[#86868B]" /> : <Copy size={13} />}
                    <span>{copiedRef ? currentT.copied : currentT.copyRef}</span>
                  </button>
                </div>

                {/* Secret PIN */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                      {currentT.pinCode}
                    </span>
                    <span className="font-mono text-base font-black text-amber-600 tracking-widest">
                      <bdi>{successData.pinCode}</bdi>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(successData.pinCode, 'pin')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FBFBFC] hover:bg-white text-[#1D1D1F] text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  >
                    {copiedPin ? <Check size={13} className="text-[#86868B]" /> : <Copy size={13} />}
                    <span>{copiedPin ? currentT.copied : currentT.copyPin}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#6E6E73] px-4 py-3">
                  <KeyRound size={14} className="shrink-0 text-[#86868B]" />
                  <span>
                    با این دو مشخصه می‌توانید در هر زمان آگهی خود را ویرایش یا حذف نمایید.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-bold text-xs hover:bg-black active:scale-95 transition-all cursor-pointer"
              >
                {currentT.close}
              </button>
            </div>
          ) : (
            /* Post Ad Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-semibold">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* STEP 1: Country, Category, City & Area */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
              {/* 1. Country Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  کشور محل آگهی *
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {activeCountries.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setAdCountry(c.id);
                        const firstCity = c.cities.find(city => city.id !== 'all')?.id || '';
                        setCity(firstCity);
                        setPriceType(c.currency);
                      }}
                      className={`flex items-center justify-center py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        adCountry === c.id
                          ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-2xs font-extrabold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{c.nameFa}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Category & City row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    دسته‌بندی آگهی *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fa}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شهر در {currentCountryObj.nameFa} *
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {currentCountryObj.cities.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fa} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  محله یا منطقه (اختیاری)
                </label>
                <input
                  type="text"
                  placeholder="مثال: کیستا، سنتروم، مایورستوئن، نربرو..."
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-sm py-3.5 shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96] cursor-pointer"
                >
                  <span>مرحله بعدی: جزئیات آگهی</span>
                  <ChevronLeft size={17} />
                </button>
              </div>
                </div>
              )}

              {/* STEP 2: Title, Price, Description & Photos */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان آگهی *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: اجاره آپارتمان ۲ خوابه نوساز مبله..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Price & Currency */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    قیمت (اختیاری)
                  </label>
                  <input
                    type="number"
                    placeholder="مثال: 12000 (خالی = توافقی)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    واحد پول
                  </label>
                  <input
                    type="text"
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value)}
                    placeholder={currentCountryObj.currency}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  توضیحات کامل آگهی *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="مشخصات کامل ملک، خدمات، ساعات کار، شرایط یا توضیحات مربوطه را بنویسید..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Photos (Cloudflare R2 Direct Upload: Max 4 photos, Max 1 MB each) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    تصاویر آگهی
                  </label>
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                    {imagesList.length} از {MAX_PHOTOS} تصویر • حداکثر ۱ مگابایت
                  </span>
                </div>

                {imagesList.length < MAX_PHOTOS && (
                  <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
                    uploadingPhotos
                      ? 'border-blue-300 bg-blue-50/50 pointer-events-none'
                      : 'border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30'
                  }`}>
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
                        <Loader2 size={22} className="text-[#86868B] animate-spin" />
                        <span className="text-xs font-bold text-blue-700">در حال فشرده‌سازی و آپلود تصویر...</span>
                      </>
                    ) : (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73]">
                          <Upload size={18} />
                        </div>
                        <div className="space-y-0.5">
                          <span className="block text-xs font-bold text-slate-800">
                            انتخاب تصاویر از گالری یا کامپیوتر
                          </span>
                          <span className="block text-[10.5px] text-slate-400">
                            حداکثر ۴ عکس • فشرده‌سازی خودکار زیر ۱ مگابایت
                          </span>
                        </div>
                      </>
                    )}
                  </label>
                )}

                {imagesList.length > 0 && (
                  <div className="grid grid-cols-4 gap-2.5 pt-1">
                    {imagesList.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group">
                        <img src={url} alt={`پیش‌نمایش ${idx + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 end-1.5 h-6 w-6 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="حذف تصویر"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowUrlFallback(!showUrlFallback)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <ImageIcon size={12} />
                    <span>{showUrlFallback ? 'بستن افزودن با لینک' : 'یا افزودن تصویر با لینک مستقیم'}</span>
                  </button>

                  {showUrlFallback && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="url"
                        dir="ltr"
                        placeholder="https://..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={addImage}
                        className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold active:scale-95 transition-all cursor-pointer"
                      >
                        افزودن
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="h-12 px-5 rounded-full border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer shrink-0"
                >
                  <ChevronRight size={16} />
                  <span>قبلی</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 h-12 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96] cursor-pointer"
                >
                  <span>مرحله بعدی: اطلاعات تماس و انتشار</span>
                  <ChevronLeft size={17} />
                </button>
              </div>
                </div>
              )}

              {/* STEP 3: Contact Info, PIN, VIP & Publish */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
              {/* Contact Info Header */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  اطلاعات تماس آگهی‌دهنده
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نام و نام خانوادگی *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="نام شما"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      شماره تماس
                    </label>
                    <input
                      type="tel"
                      placeholder="مثال: 0731234567 یا 091234567"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none font-mono text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      شماره واتساپ
                    </label>
                    <input
                      type="tel"
                      placeholder="مثال: +46731234567"
                      value={contactWhatsapp}
                      onChange={(e) => setContactWhatsapp(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none font-mono text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      آیدی تلگرام
                    </label>
                    <input
                      type="text"
                      placeholder="username@ یا آیدی تلگرام"
                      value={contactTelegram}
                      onChange={(e) => setContactTelegram(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ایمیل
                    </label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      وب‌سایت / لینک (اختیاری)
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={contactWebsite}
                      onChange={(e) => setContactWebsite(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none text-left font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    لینک API پنل فروش (فروشگاه یا منوی رستوران - اختیاری)
                  </label>
                  <input
                    type="url"
                    placeholder="https://.../api/storefront?key=sk_live_..."
                    value={sellerApiUrl}
                    onChange={(e) => setSellerApiUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none text-left font-mono"
                    dir="ltr"
                  />
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    اگر در پنل فروش لینک شو فروشگاه یا منوی رستوران دارید، لینک API خود را اینجا وارد کنید تا محصولاتتان داخل آگهی نمایش داده و فروخته شوند.
                  </p>
                </div>
              </div>

              {/* Auto-generated 6-character security PIN notice (not user-editable) */}
              <div className="rounded-2xl bg-amber-50/70 p-3.5 flex items-start gap-3">
                <KeyRound size={17} className="text-[#86868B] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-amber-950">
                    کد امنیتی ۶ کاراکتری مدیریت آگهی (خودکار)
                  </span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    برای امنیت بیشتر، یک کد ۶ کاراکتری غیرقابل‌حدس به‌صورت خودکار توسط سیستم تولید و بلافاصله پس از ثبت آگهی به شما نمایش داده می‌شود.
                  </p>
                </div>
              </div>

              {/* VIP Promotion Upgrade Box - Clean & Minimal */}
              <label 
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  wantVipPromotion 
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500' 
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={wantVipPromotion}
                    onChange={(e) => setWantVipPromotion(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      ارتقا به آگهی ویژه (VIP) در {currentCountryObj.nameFa}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      نمایش در بالای لیست و سایدبار ویژه کشور {currentCountryObj.nameFa}
                    </span>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-sm font-extrabold text-blue-700">
                    {currentCountryObj.currency === '€' ? '۹ یورو (€)' : '۹۹ کرون'}
                  </span>
                </div>
              </label>

              {/* Cloudflare Turnstile Anti-Bot Verification */}
              {turnstileSettings.enabled !== false && turnstileSettings.protectPostAd !== false && (
                <div className="pt-2 pb-1 flex flex-col items-center justify-center">
                  <CloudflareTurnstile
                    theme="light"
                    siteKey={turnstileSettings.mode === 'live' ? turnstileSettings.siteKey : undefined}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                      setErrorMsg('');
                    }}
                    onExpire={() => setTurnstileToken('')}
                  />
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="h-12 px-5 rounded-full border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] cursor-pointer shrink-0"
                >
                  <ChevronRight size={16} />
                  <span>قبلی</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-full bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold text-sm shadow-xs transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.96] cursor-pointer"
                >
                  <PlusCircle size={16} />
                  <span>
                    {loading 
                      ? 'در حال ثبت...' 
                      : (wantVipPromotion ? `ثبت و پرداخت ویژه (${currentCountryObj.currency === '€' ? '۹ یورو' : '۹۹ کرون'})` : 'انتشار رایگان آگهی')}
                  </span>
                </button>
              </div>
                </div>
              )}

            </form>
          )}

        </div>
      </div>
    </div>
  );
}
