import { describe, expect, it } from 'vitest'
import { mailtoHref, telHref } from './contact-links'

describe('reporter contact links', () => {
  it('links plain phone numbers and email addresses', () => {
    expect(telHref('+234 (803) 123-4567')).toBe('tel:+2348031234567')
    expect(mailtoHref(' ada.obi@example.com ')).toBe('mailto:ada.obi@example.com')
  })

  it('refuses anything that could add mail headers or change the scheme', () => {
    expect(mailtoHref('a@b.co?bcc=attacker@x.com&body=hi')).toBeNull()
    expect(mailtoHref('a%3Fbcc%3Dx@b.co')).toBeNull()
    expect(mailtoHref('javascript:alert(1)//@b.co')).toBeNull()
    expect(telHref('123;javascript:alert(1)')).toBeNull()
    expect(telHref('call me at 0803')).toBeNull()
  })
})
