import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import QRCode from 'qrcode';

export function InvitationQr({ payload, remainingMs }: { payload: string; remainingMs: number }) {
  const { t } = useTranslation();
  const [image, setImage] = useState<{ payload: string; url: string } | null>(null);
  const [failedPayload, setFailedPayload] = useState<string | null>(null);
  const [expiredPayload, setExpiredPayload] = useState<string | null>(null);

  useEffect(() => {
    // This only hides the display; native elapsed time remains the authorization authority.
    const timer = window.setTimeout(() => setExpiredPayload(payload), Math.max(0, remainingMs));
    return () => window.clearTimeout(timer);
  }, [payload, remainingMs]);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M', margin: 4, width: 360,
      color: { dark: '#1c1917', light: '#ffffff' },
    }).then((url) => {
      if (active) setImage({ payload, url });
    }).catch(() => {
      if (active) setFailedPayload(payload);
    });
    return () => { active = false; };
  }, [payload]);

  return <div className="pairing-qr-stage">
    {expiredPayload === payload
      ? <p className="pairing-attention" role="status">{t('pairing.qrUnavailable')}</p>
      : image?.payload === payload
      ? <img alt={t('pairing.qrAlt')} className="pairing-qr-image" draggable={false} src={image.url} />
      : <div className="pairing-qr-placeholder" role={failedPayload === payload ? 'alert' : 'status'}>
        <QrCode aria-hidden="true" size={40} />
        <p>{t(failedPayload === payload ? 'pairing.qrFailed' : 'pairing.qrRendering')}</p>
      </div>}
  </div>;
}
