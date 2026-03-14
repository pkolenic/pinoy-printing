import sanitizeHtml from 'sanitize-html';

/**
 * Escape special characters in a path string for use in a regular expression.
 * @param path
 */
export const escapePath = (path: string): string => {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const sanitizeOptions = {
  // Mode for plain text: Strings All tags
  plainText: {
    allowedTags: [],
    allowedAttributes: {},
  },
  // Mode for Rich Text: Allows basic formatting
  richText: {
    // Use a curated list rather than everything
    allowedTags: [
      'h3', 'h4', 'h5', 'h6', // Avoid h1/h2 to keep page SEO hierarchy correct
      'strong', 'b', 'i', 'em', 'u', 'strike', // Text formatting
      'p', 'br', 'hr', // Structure
      'ul', 'ol', 'li', // Lists
      'a', 'blockquote', 'code', 'pre' // Links, blockquotes, code blocks
    ],
    allowedAttributes: {
      'a': ['href', 'rel', 'target'], // Allow links but restrict to Essential Link attributes
    },
    // Security: Ensure links don't use 'javascript:' or other malicious schemes
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // Security: Force external links to be safe
    transformTags: {
      'a': sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
    }
  },
}

interface SanitizeConfig {
  mode?: 'plainText' | 'richText';
  lowercase?: boolean;
  trim?: boolean;
}

/**
 * Sanitizer function for express-validator customSanitizer
 */
export const cleanText = (config: SanitizeConfig = {}) => {
  const { mode = 'plainText', lowercase = false, trim = true } = config;

  return (value: string): string => {
    if (!value) {
      return value;
    }

    let cleaned = sanitizeHtml(value, sanitizeOptions[mode]);

    if (trim) {
      cleaned = cleaned.trim();
    }
    if (lowercase) {
      cleaned = cleaned.toLowerCase();
    }

    return cleaned;
  };
};
