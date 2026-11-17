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
