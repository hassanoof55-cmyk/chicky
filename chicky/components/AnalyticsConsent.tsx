import React, { useEffect, useId, useRef, useState } from 'react';
import type { Language } from '../types';
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent, setAnalyticsConsent } from '../lib/analytics';
import type { AnalyticsConsent as Consent } from '../lib/analytics';

/** Optional measurement starts only after an explicit acceptance. */
export default function AnalyticsConsent(_props: { lang: Language }) {
  const [consent, setConsent] = useState(getAnalyticsConsent);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const settings = useRef<HTMLButtonElement>(null);
  const id = useId();
  const open = expanded || consent === 'unknown';

  useEffect(() => {
    const update = () => setConsent(getAnalyticsConsent());
    window.addEventListener(ANALYTICS_CONSENT_EVENT, update);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, update);
  }, []);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const panel = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.showModal();
    return () => {
      panel.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const choose = (value: Consent) => {
    setAnalyticsConsent(value);
    setConsent(value);
    setExpanded(false);
    settings.current?.focus();
  };
  const dismiss = () => {
    if (consent === 'unknown') choose('rejected');
    else setExpanded(false);
  };

  return (
    <aside lang="en" dir="ltr" className="privacy-preferences">
      {open && (
        <dialog ref={dialog} id={`${id}-panel`} role="dialog" aria-modal="true"
          aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
          className="privacy-dialog"
          onCancel={event => { event.preventDefault(); dismiss(); }}
          onClick={event => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
          }}>
          <h2 id={`${id}-title`} className="storefront-loading__sr">Your privacy preferences</h2>
          <p id={`${id}-description`} className="privacy-dialog__copy">
            We use essential storage to keep your cart working. With your permission, optional cookies help us understand how our website is used. Read our{' '}
            <a href="/privacy">Privacy Policy</a>.
          </p>
          <button type="button" autoFocus onClick={() => choose('accepted')} className="privacy-dialog__accept">
            Accept &amp; Continue
          </button>
        </dialog>
      )}
      <button type="button" ref={settings} aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => consent === 'accepted' ? choose('rejected') : setExpanded(true)} className="privacy-preferences__link">
        {consent === 'accepted' ? 'Turn off analytics' : 'Privacy settings'}
      </button>
    </aside>
  );
}
