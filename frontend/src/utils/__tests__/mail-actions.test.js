// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildReplyModel, buildForwardModel } from '../mail-actions'

describe('buildReplyModel', () => {
  it('uses HTML content in blockquote when message is present', () => {
    const mail = {
      source: 'Alice <alice@example.com>',
      originalSource: 'alice@example.com',
      subject: 'Hello',
      message: '<p>HTML body</p>',
      text: 'Plain body',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).toBe(
      '<p><br></p><blockquote><p>HTML body</p></blockquote><p><br></p>'
    )
    expect(result.contentType).toBe('html')
  })

  it('falls back to plain text when message is empty string', () => {
    const mail = {
      source: 'bob@example.com',
      originalSource: 'bob@example.com',
      subject: 'Hi',
      message: '',
      text: 'Plain text fallback',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).toBe(
      '<p><br></p><blockquote>Plain text fallback</blockquote><p><br></p>'
    )
    expect(result.contentType).toBe('rich')
  })

  it('falls back to plain text when message is null', () => {
    const mail = {
      source: 'carol@example.com',
      originalSource: 'carol@example.com',
      subject: 'Test',
      message: null,
      text: 'Fallback text',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).toBe(
      '<p><br></p><blockquote>Fallback text</blockquote><p><br></p>'
    )
  })

  it('returns empty content when both message and text are empty', () => {
    const mail = {
      source: 'dave@example.com',
      originalSource: 'dave@example.com',
      subject: 'Empty',
      message: '',
      text: '',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).toBe('')
  })

  it('returns empty content when both message and text are null', () => {
    const mail = {
      source: 'eve@example.com',
      originalSource: 'eve@example.com',
      subject: 'Null',
      message: null,
      text: null,
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).toBe('')
  })

  it('parses "Name <email>" format for sender', () => {
    const mail = {
      source: 'Alice Smith <alice@example.com>',
      originalSource: 'alice@example.com',
      subject: 'Test',
      message: '<p>body</p>',
      text: '',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.toName).toBe('Alice Smith')
    expect(result.toMail).toBe('alice@example.com')
  })

  it('uses originalSource as toMail when source is plain email', () => {
    const mail = {
      source: 'plain@example.com',
      originalSource: 'plain@example.com',
      subject: 'Test',
      message: '',
      text: 'body',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.toName).toBe('')
    expect(result.toMail).toBe('plain@example.com')
  })

  it('defaults toMail to empty string when originalSource is null', () => {
    const mail = {
      source: 'plain@example.com',
      originalSource: null,
      subject: 'Test',
      message: '',
      text: 'body',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.toMail).toBe('')
  })

  it('formats subject with reply label', () => {
    const mail = {
      source: 'test@example.com',
      originalSource: 'test@example.com',
      subject: 'Original Subject',
      message: '',
      text: '',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.subject).toBe('Reply: Original Subject')
  })

  it('uses html contentType for HTML email reply', () => {
    const mail = {
      source: 'test@example.com',
      originalSource: 'test@example.com',
      subject: 'Test',
      message: '<p>html</p>',
      text: 'plain',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.contentType).toBe('html')
  })

  it('uses rich contentType for plain text email reply', () => {
    const mail = {
      source: 'test@example.com',
      originalSource: 'test@example.com',
      subject: 'Test',
      message: '',
      text: 'plain',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.contentType).toBe('rich')
  })

  it('strips script tags from HTML reply content (XSS)', () => {
    const mail = {
      source: 'attacker@example.com',
      originalSource: 'attacker@example.com',
      subject: 'XSS',
      message: '<p>Hello</p><script>alert("xss")</script><p>World</p>',
      text: '',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).not.toContain('<script>')
    expect(result.content).toContain('<p>Hello</p>')
    expect(result.content).toContain('<p>World</p>')
  })

  it('strips event handlers from HTML reply content (XSS)', () => {
    const mail = {
      source: 'attacker@example.com',
      originalSource: 'attacker@example.com',
      subject: 'XSS',
      message: '<img src=x onerror="alert(1)"><p>Text</p>',
      text: '',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).not.toContain('onerror')
    expect(result.content).toContain('<p>Text</p>')
  })

  it('escapes HTML chars in plain text reply content', () => {
    const mail = {
      source: 'user@example.com',
      originalSource: 'user@example.com',
      subject: 'Test',
      message: '',
      text: 'a < b & c > d',
    }
    const result = buildReplyModel(mail, 'Reply')
    expect(result.content).toContain('a &lt; b &amp; c &gt; d')
    expect(result.content).not.toContain('a < b')
  })
})

describe('buildForwardModel', () => {
  it('uses html contentType when message is present', () => {
    const mail = {
      subject: 'FW Test',
      message: '<p>HTML content</p>',
      text: 'Plain content',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.contentType).toBe('html')
    expect(result.content).toBe('<p>HTML content</p>')
  })

  it('uses text contentType when message is empty', () => {
    const mail = {
      subject: 'FW Test',
      message: '',
      text: 'Plain text only',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.contentType).toBe('text')
    expect(result.content).toBe('Plain text only')
  })

  it('uses text contentType when message is null', () => {
    const mail = {
      subject: 'FW Test',
      message: null,
      text: 'Fallback text',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.contentType).toBe('text')
    expect(result.content).toBe('Fallback text')
  })

  it('formats subject with forward label', () => {
    const mail = {
      subject: 'Original',
      message: '',
      text: '',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.subject).toBe('Forward: Original')
  })

  it('strips script tags from HTML forward content (XSS)', () => {
    const mail = {
      subject: 'XSS Test',
      message: '<div>Safe</div><script>alert("xss")</script>',
      text: '',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.content).not.toContain('<script>')
    expect(result.content).toContain('<div>Safe</div>')
  })

  it('strips event handlers from HTML forward content (XSS)', () => {
    const mail = {
      subject: 'XSS Test',
      message: '<img src=x onerror="alert(1)"><b>Bold</b>',
      text: '',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.content).not.toContain('onerror')
    expect(result.content).toContain('<b>Bold</b>')
  })

  it('escapes special chars in plain text forward content', () => {
    const mail = {
      subject: 'FW Text',
      message: '',
      text: 'a < b & c > d',
    }
    const result = buildForwardModel(mail, 'Forward')
    expect(result.contentType).toBe('text')
    expect(result.content).toBe('a &lt; b &amp; c &gt; d')
  })
})
