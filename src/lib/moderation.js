// Client-side pre-submission content safety filter (Persian, English, Swedish)
// Blocks obvious adult/sexual services, child exploitation, and illegal abuse before upload.
const PROHIBITED_PATTERNS = [
  // Child exploitation / CSAM (strict zero tolerance)
  /\b(csam|cp|child\s*porn|underage\s*sex|pedo|pedophil|loli|shota)\b/i,
  /(کودک\s*آزاری|بچه\s*بازی|سکس\s*کودک|پورن\s*کودک)/i,
  /\b(barnpornografi|barnmisshandel|sex\s*med\s*barn)\b/i,

  // Adult / sexual services & explicit escort content
  /\b(escort|call\s*girl|prostitut|brothel|happy\s*ending|sex\s*service|porn|xxx|onlyfans)\b/i,
  /(سکس|پورن|روسپی|تن\s*فروشی|صیغه\s*ساعتی|ماساژ\s*جنسی|خدمات\s*جنسی|فیلم\s*سوپر|شهوانی|جنده)/i,
  /\b(eskort|sexköp|sexuella\s*tjänster|erotisk\s*massage|porr)\b/i,
];

export const DESCRIPTION_LINK_ERROR_MSG =
  'لینک در توضیحات مجاز نیست. آدرس سایت را در بخش وبسایت بنویسید.';

const SCHEME_URL_RE = /(?:https?|ftp):\/\//i;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const WWW_URL_RE = /(?<![a-z0-9@._-])www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
const MESSENGER_SHORTLINK_RE =
  /(?<![a-z0-9@._-])(?:t\.me|telegram\.me|wa\.me|youtu\.be|bit\.ly|tinyurl\.com|goo\.gl|rb\.gy|shorturl\.at|instagr\.am|fb\.me)(?:\/[^\s]*)?(?=$|[\s)\]}"'»،؛,:!؟])/i;
const BARE_DOMAIN_RE =
  /(?<![a-z0-9@._-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|se|eu|no|dk|fi|de|at|nl|fr|ir|net|org|io|co|info|biz|shop|store|app|dev|site|online|xyz|uk|us|ca|me|tv|gg|ai|nu|ch|be|it|es)(?=$|[\s/\\?#)\]}"'»،؛,:!؟])/i;

/**
 * Browser-side detector for URLs and domain links inside ad description text.
 * Leaves numbers, prices, decimals, measurements, dates, and phone numbers untouched.
 */
export function containsLinkInDescription(text) {
  if (!text || typeof text !== 'string') return false;
  if (SCHEME_URL_RE.test(text)) return true;

  const cleaned = text.replace(EMAIL_RE, ' ');
  if (WWW_URL_RE.test(cleaned)) return true;
  if (MESSENGER_SHORTLINK_RE.test(cleaned)) return true;
  if (BARE_DOMAIN_RE.test(cleaned)) return true;

  return false;
}

export function checkProhibitedContent({ title = '', description = '', area = '', contactName = '' } = {}) {
  const combined = [title, description, area, contactName].filter(Boolean).join(' ');
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        blocked: true,
        reason: 'محتوای آگهی شامل کلمات غیرمجاز یا مغایر با قوانین ایمنی پلتفرم است و امکان ثبت آن وجود ندارد.',
      };
    }
  }
  return { blocked: false, reason: '' };
}
