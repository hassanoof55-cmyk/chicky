import React from 'react';

export default function StorefrontLoading({ failed = false }: { failed?: boolean }) {
  return (
    <main className="storefront-loading" aria-busy={!failed}>
      <section className="storefront-loading__content" aria-live="polite">
        <img className={`storefront-loading__logo ${failed ? '' : 'storefront-loading__pulse'}`}
          src="/brand/chicky-red.png" width="678" height="196" alt="CHICKY" fetchPriority="high" />
        <h1 className="storefront-loading__name">CHICKY</h1>
        {failed ? (
          <div role="alert" dir="rtl" className="storefront-loading__error">
            <p>المنيو غير متاح مؤقتًا</p>
            <p className="storefront-loading__hint">حاول مرة تانية بعد شوية.</p>
            <button className="storefront-loading__retry" onClick={() => window.location.reload()}>إعادة المحاولة</button>
          </div>
        ) : (
          <>
            <p className="storefront-loading__caption" role="status">SYNCING CLOUD DATABASE<span className="storefront-loading__dots">...</span></p>
            <span className="storefront-loading__sr" lang="ar">جاري تحميل المنيو الحقيقي من قاعدة البيانات</span>
          </>
        )}
      </section>
    </main>
  );
}
