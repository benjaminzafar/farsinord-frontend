import React, { useEffect, useRef, useState } from 'react';
import {
  CLOUDFLARE_TEST_SITEKEY,
  resolveTurnstileSiteKey,
  formatTurnstileError,
} from '../lib/turnstileConfig';

export { CLOUDFLARE_TEST_SITEKEY };

export default function CloudflareTurnstile({
  mode,
  siteKey,
  theme = 'auto',
  onVerify,
  onExpire,
  onError,
  className = ''
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const [loaded, setLoaded] = useState(() => typeof window !== 'undefined' && Boolean(window.turnstile));
  const [errorState, setErrorState] = useState({ key: '', msg: '' });

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  });

  const effectiveKey = (() => {
    let stored = null;
    if (mode === undefined || mode === null) {
      try {
        const saved = localStorage.getItem('swedpersiska_turnstile_settings');
        if (saved) stored = JSON.parse(saved);
      } catch {}
    }
    return resolveTurnstileSiteKey({ mode, siteKey, storedSettings: stored });
  })();

  const missingLiveKey = mode === 'live' && !effectiveKey;
  const visibleError = missingLiveKey
    ? 'کلید عمومی کلودفلر (Site Key) در تنظیمات مدیریت وارد نشده است.'
    : (errorState.key === effectiveKey ? errorState.msg : '');

  useEffect(() => {
    if (window.turnstile) return;

    const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existingScript) {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          setLoaded(true);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setLoaded(true);
    };
    script.onerror = () => {
      setErrorState({ key: effectiveKey, msg: 'خطا در بارگذاری سامانه امنیتی کلودفلر' });
      callbacksRef.current.onError?.('Script load error');
    };
    document.head.appendChild(script);
  }, [effectiveKey]);

  useEffect(() => {
    if (!loaded || !window.turnstile || !containerRef.current || !effectiveKey) return;

    if (widgetIdRef.current !== null) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
    }

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: effectiveKey,
        theme,
        callback: (token) => {
          setErrorState({ key: '', msg: '' });
          callbacksRef.current.onVerify?.(token);
        },
        'expired-callback': () => {
          callbacksRef.current.onExpire?.();
        },
        'error-callback': (err) => {
          console.warn('Cloudflare Turnstile error:', err);
          setErrorState({ key: effectiveKey, msg: formatTurnstileError(err) });
          callbacksRef.current.onError?.(err);
        }
      });

      widgetIdRef.current = widgetId;
    } catch (e) {
      console.error('Failed to render Cloudflare Turnstile widget:', e);
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [loaded, effectiveKey, theme]);

  return (
    <div className={`cloudflare-turnstile-container flex flex-col items-center justify-center min-h-[68px] ${className}`} dir="ltr">
      <div ref={containerRef} className="inline-block" />
      {visibleError && (
        <span className="text-[11px] text-rose-500 mt-1.5 font-medium font-vazir text-center leading-relaxed" dir="rtl">
          {visibleError}
        </span>
      )}
    </div>
  );
}
