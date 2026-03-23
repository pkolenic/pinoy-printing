import { describe, it, expect } from 'vitest'

import {
  escapePath,
  cleanText
} from './strings.js';

describe('escapePath', () => {
  it('should escape regex special characters correctly', () => {
    // Test characters that would normally break a RegExp
    const messyPath = 'c++ / . * ? ^ $ ( ) [ ] { } | \\';
    const escaped = escapePath(messyPath);

    // Verify that we can actually create a RegExp with the escaped string
    // without it throwing or matching incorrectly
    const regex = new RegExp(`^${escaped}$`);
    expect(regex.test(messyPath)).toBe(true);

    // Specifically, check a common one for your categories: "c++"
    expect(escapePath('c++')).toBe('c\\+\\+');
  });

  it('should return an empty string if input is empty', () => {
    expect(escapePath('')).toBe('');
  });

  it('should NOT match a string that is slightly different', () => {
    const escaped = escapePath('c++');
    const regex = new RegExp(`^${escaped}$`);
    expect(regex.test('c+')).toBe(false); // Proves it's looking for exactly two pluses
  });
});

describe('cleanText', () => {
  describe('default options', () => {
    // mode: 'plainText', lowercase: false, trim: true,
    const sanitizer = cleanText();

    it('should strip all HTML tags', () => {
      const input = '<div><p>Hello <b>World</b></p><script>alert(1)</script></div>';
      expect(sanitizer(input)).toBe('Hello World');
    });

    it('should NOT lowercase text', () => {
      expect(sanitizer('UPPERCASE')).toBe('UPPERCASE');
    });

    it('should trim whitespace', () => {
      expect(sanitizer('   spaced out   ')).toBe('spaced out');
    })

    it('should strip all HTML tags, trim, and NOT lowercase text by default', () => {
      const input = '   <div><p>HELLO <b>World</b></p><script>alert(1)</script></div>  ';
      expect(sanitizer(input)).toBe('HELLO World');
    })
  });

  describe('plainText mode configuration', () => {
    it('should apply default settings (strip tags, trim, no lowercase)', () => {
      const sanitizer = cleanText();
      expect(sanitizer('  <p>HELLO</p>  ')).toBe('HELLO');
    });

    it('should respect lowercase and trim flags independently', () => {
      // Only lowercase
      expect(cleanText({ lowercase: true, trim: false })('  HI  ')).toBe('  hi  ');
      // Only trim
      expect(cleanText({ lowercase: false, trim: true })('  HI  ')).toBe('HI');
      // Both off
      expect(cleanText({ lowercase: false, trim: false })('  HI  ')).toBe('  HI  ');
    });
  });

  describe('richText mode', () => {
    const richSanitizer = cleanText({ mode: 'richText' });

    it('should allow basic formatting tags but strip dangerous ones', () => {
      // noinspection JSUnresolvedFunction,LanguageDetectionInspection
      const input = '<h3>Title</h3><p>Text with <b>bold</b> and <script>malicious()</script></p>';
      const result = richSanitizer(input);

      expect(result).toContain('<h3>Title</h3>');
      expect(result).toContain('<b>bold</b>');
      expect(result).not.toContain('<script>');
    });

    it('should force links to be secure and open in new tabs', () => {
      // noinspection HttpUrlsUsage
      const input = '<a href="http://example.com" onclick="steal()">Link</a>';
      const result = richSanitizer(input);

      expect(result).toContain('target="_blank"');

      // noinspection SpellCheckingInspection
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).not.toContain('onclick');
    });

    it('should strip forbidden schemes like javascript:', () => {
      const input = '<a href="javascript:alert(1)">Click Me</a>';
      const result = richSanitizer(input);
      // sanitize-html usually removes the href if the scheme is forbidden
      expect(result).not.toContain('href="javascript:');
    });

    it('should strip H1 and H2 tags for SEO safety', () => {
      const input = '<h1>Big</h1><h2>Medium</h2><h3>Small</h3>';
      const result = richSanitizer(input);

      expect(result).not.toContain('<h1>');
      expect(result).not.toContain('<h2>');
      expect(result).toContain('<h3>Small</h3>');
    });

    it('should allow mailto: and tel: schemes', () => {
      const input = '<a href="mailto:test@example.com">Email</a><a href="tel:123">Call</a>';
      const result = richSanitizer(input);
      expect(result).toContain('href="mailto:test@example.com"');
      expect(result).toContain('href="tel:123"');
    });

    it('should fix broken or unclosed HTML tags', () => {
      const input = '<div><b>Bold text without close';
      const result = richSanitizer(input);
      // It should automatically add the closing </b> and </div> (or strip the div if not allowed)
      expect(result).toBe('<b>Bold text without close</b>');
    });

    it('should preserve list structures', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = richSanitizer(input);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
    });

    it('should strip images and other media tags', () => {
      // noinspection HtmlRequiredAltAttribute,HtmlUnknownTarget
      const input = '<p>Text</p><img src="bad.jpg"><iframe src="bad.com"></iframe>';
      const result = richSanitizer(input);
      expect(result).toBe('<p>Text</p>');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('<iframe');
    });

    it('should correctly apply lowercase and trim to richText content', () => {
      const customRich = cleanText({ mode: 'richText', lowercase: true, trim: true });
      const input = '  <H3>Trim and Lower</H3>  ';
      const result = customRich(input);

      // Confirms that the tag is fixed AND the content is transformed
      expect(result).toBe('<h3>trim and lower</h3>');
    });
  });

  it('should return empty or undefined values as-is (null/undefined/empty string)', () => {
    const sanitizer = cleanText();
    // @ts-ignore - testing runtime robustness
    expect(sanitizer(null)).toBe(null);
    // @ts-ignore
    expect(sanitizer(undefined)).toBe(undefined);
    expect(sanitizer('')).toBe('');
  });
});