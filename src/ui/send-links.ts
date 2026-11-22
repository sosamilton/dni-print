// Pure helpers for desktop sending: Gmail / mailto / WhatsApp Web links.
// Opening these links is a user-initiated navigation, never a request made by the app.

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/

/** Empty is fine (the recipient is optional); otherwise it must look like an email address. */
export function validateEmail(input: string): { ok: true; email: string } | { ok: false } {
  const email = String(input).trim()
  if (email === '') return { ok: true, email }
  return EMAIL.test(email) ? { ok: true, email } : { ok: false }
}

export function gmailUrl(to: string, subject: string, body: string): string {
  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  )
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function whatsappWebUrl(digits: string, text: string): string {
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`
}
