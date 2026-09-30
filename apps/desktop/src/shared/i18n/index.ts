import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import tr from './locales/tr.json';

void i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  lng: 'tr',
  resources: { de: { translation: de }, en: { translation: en }, tr: { translation: tr } },
});

export { i18n };
