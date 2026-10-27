
import { useEffect, useRef } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({
  onCredential,
  disabled = false
}) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    let cancelled = false;
    let script = null;

    const renderButton = () => {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !containerRef.current
      ) {
        return;
      }

      containerRef.current.replaceChildren();

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: response => {
          if (response?.credential) {
            callbackRef.current(response.credential);
          }
        }
      });

      window.google.accounts.id.renderButton(
        containerRef.current,
        {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          width: 300
        }
      );
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      script = document.querySelector(
        'script[data-google-identity="true"]'
      );

      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        script.addEventListener('load', renderButton);
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', renderButton);
      }
    }

    return () => {
      cancelled = true;
      script?.removeEventListener('load', renderButton);
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="google-signin-note">
        Google sign-in is not configured yet.
      </p>
    );
  }

  return (
    <div
      className="google-signin-container"
      style={{
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.55 : 1
      }}
    >
      <div ref={containerRef} />
    </div>
  );
}
