import DOMPurify from 'dompurify';

export const sanitizeHtml = (html) => {
    return DOMPurify.sanitize(typeof html === 'string' ? html : '');
};
