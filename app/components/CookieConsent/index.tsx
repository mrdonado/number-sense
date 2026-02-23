"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import styles from "./CookieConsent.module.css";

const CONSENT_KEY = "cookie_consent";
const GA_ID = "G-EY92D76VTE";
// 1 year in seconds
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ConsentState = "accepted" | "declined" | null;

function getConsentCookie(): ConsentState {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_KEY}=`));
  const value = match?.split("=")[1];
  if (value === "accepted" || value === "declined") return value;
  return null;
}

function setConsentCookie(value: "accepted" | "declined") {
  document.cookie = `${CONSENT_KEY}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(() => {
    if (typeof window === "undefined") return null;
    return getConsentCookie();
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consent === null) {
      // Slight delay so the banner doesn't flash on initial paint
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [consent]);

  const accept = () => {
    setConsentCookie("accepted");
    setConsent("accepted");
    setVisible(false);
  };

  const decline = () => {
    setConsentCookie("declined");
    setConsent("declined");
    setVisible(false);
  };

  return (
    <>
      {/* Load GA only after explicit consent */}
      {consent === "accepted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {/* Consent banner */}
      {visible && (
        <div
          className={styles.banner}
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
        >
          <p className={styles.text}>
            This site uses Google Analytics to understand how visitors interact
            with it. No data is collected without your consent.{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Learn more
            </a>
            .
          </p>
          <div className={styles.actions}>
            <button className={styles.declineButton} onClick={decline}>
              Decline
            </button>
            <button className={styles.acceptButton} onClick={accept}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
