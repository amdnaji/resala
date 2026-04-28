export interface Language {
  code: string;
  name: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    dir: 'ltr',
  },
  {
    code: 'ar',
    name: 'العربية',
    dir: 'rtl',
  },
];

export const DEFAULT_LANGUAGE = 'en';

export const getLanguageByCode = (code: string) => 
  SUPPORTED_LANGUAGES.find(lang => lang.code === code) || SUPPORTED_LANGUAGES[0];
