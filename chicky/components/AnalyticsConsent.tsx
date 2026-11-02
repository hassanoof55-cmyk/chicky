import React, { useEffect, useId, useRef, useState } from 'react';
import type { Language } from '../types';
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent, setAnalyticsConsent } from '../lib/analytics';
import type { AnalyticsConsent as Consent } from '../lib/analytics';

const copy = {
  en: {
    title: 'Optional analytics',
    description: 'With your permission, Google Analytics helps us understand menu browsing and ordering steps. We do not send your name, phone, address or order notes. Rejecting analytics does not affect ordering. You can change your choice anytime.',
    accept: 'Accept analytics', reject: 'Reject analytics', settings: 'Analytics settings', close: 'Close settings',
    accepted: 'Analytics is on.', rejected: 'Analytics is off.', unknown: 'Analytics is off until you accept.',
  },
  ar: {
    title: 'تحليلات اختيارية',
    description: 'بموافقتك، Google Analytics بيساعدنا نفهم تصفح المنيو وخطوات الطلب. مش بنبعت اسمك أو تليفونك أو عنوانك أو ملاحظات الطلب. رفض التحليلات مش بيأثر على طلبك، وتقدر تغيّر اختيارك في أي وقت.',
    accept: 'قبول التحليلات', reject: 'رفض التحليلات', settings: 'إعدادات التحليلات', close: 'قفل الإعدادات',
    accepted: 'التحليلات مفعّلة.', rejected: 'التحليلات مقفولة.', unknown: 'التحليلات مقفولة لحد ما توافق.',
  },
};

/** Mount once in the storefront. This component never configures or loads GA itself. */
export default function AnalyticsConsent({ lang }: { lang: Language }) {
  const [consent, setConsent] = useState(getAnalyticsConsent);
  const [expanded, setExpanded] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const settings = useRef<HTMLButtonElement>(null);
  const id = useId();
  const text = copy[lang];
  const open = expanded || consent === 'unknown';

  useEffect(() => {
    const update = () => setConsent(getAnalyticsConsent());
    window.addEventListener(ANALYTICS_CONSENT_EVENT, update);
    update();
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, update);
  }, []);

  useEffect(() => { if (expanded) heading.current?.focus(); }, [expanded]);

  const close = () => {
    setExpanded(false);
    settings.current?.focus();
  };
  const choose = (value: Consent) => {
    setAnalyticsConsent(value);
    setConsent(value);
    close();
  };
  const choiceClass = 'min-h-11 flex-1 rounded-xl border-2 border-gray-900 bg-white px-4 py-3 font-bold text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';

  return (
    <aside lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="fixed bottom-32 md:bottom-3 left-3 right-3 z-[60] max-w-lg text-gray-900 sm:right-auto">
      {open && (
        <section id={`${id}-panel`} role="region" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
          className="mb-2 rounded-2xl border border-gray-300 bg-white p-4 shadow-xl"
          onKeyDown={event => { if (event.key === 'Escape' && consent !== 'unknown') { event.preventDefault(); close(); } }}>
          <h2 id={`${id}-title`} tabIndex={-1} ref={heading} className="text-lg font-bold">{text.title}</h2>
          <p id={`${id}-description`} className="my-3 text-sm leading-relaxed">{text.description}</p>
          <p className="mb-3 text-sm" role="status">{text[consent]}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={choiceClass} onClick={() => choose('accepted')}>{text.accept}</button>
            <button type="button" className={choiceClass} onClick={() => choose('rejected')}>{text.reject}</button>
          </div>
          {consent !== 'unknown' && <button type="button" onClick={close} className="mt-3 min-h-11 rounded px-3 underline focus-visible:outline focus-visible:outline-2">{text.close}</button>}
        </section>
      )}
      <button type="button" ref={settings} aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => { if (expanded && consent !== 'unknown') close(); else setExpanded(true); }}
        className="min-h-11 rounded-xl border border-gray-400 bg-white px-4 py-2 text-sm font-semibold shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
        {text.settings}
      </button>
    </aside>
  );
}
