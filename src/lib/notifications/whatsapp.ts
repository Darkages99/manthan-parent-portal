/**
 * WhatsApp "Click to Chat" links — https://faq.whatsapp.com/5913398998672934
 *
 * There is no WhatsApp Business API account for this school, so nothing here
 * can send automatically. A wa.me link opens WhatsApp (app or web) with the
 * message pre-filled; a human on the school's side still has to press send.
 * That makes it workable for low-volume, high-urgency 1:1 pings — e.g. the
 * stay-back consent approval nudge to one teacher or the principal — and NOT
 * viable for a class-wide or school-wide broadcast (that stays on in-app +
 * push, with SMS as the broadcast fallback — see sms.ts).
 */

export function buildWhatsAppLink(phoneE164: string, message: string): string {
  const digitsOnly = phoneE164.replace(/[^\d]/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

/** Opens the click-to-chat link in a new tab. Must be called from a user gesture (button click). */
export function openWhatsApp(phoneE164: string, message: string) {
  if (typeof window === "undefined") return;
  window.open(buildWhatsAppLink(phoneE164, message), "_blank", "noopener,noreferrer");
}
