/**
 * Reporter contact details are free text from the public. A link is offered only when the value is plainly a
 * phone number or a bare email address, so it cannot carry extra mailto headers (cc/bcc/body) or another scheme.
 */
const PHONE = /^\+?[0-9 ()-]{3,30}$/
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export function telHref(phone: string): string | null {
  const value = phone.trim()
  return PHONE.test(value) ? `tel:${value.replace(/[ ()-]/g, '')}` : null
}

export function mailtoHref(email: string): string | null {
  const value = email.trim()
  // '%' is allowed in the local part by the pattern, but would let encoded '?' or '&' through.
  return EMAIL.test(value) && !value.includes('%') ? `mailto:${value}` : null
}
