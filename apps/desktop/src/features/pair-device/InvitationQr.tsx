import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

function isFinder(x: number, y: number, n: number) {
  return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function InvitationQr({ payload, remainingMs }: { payload: string; remainingMs: number }) {
  const { t } = useTranslation();
  const [expiredPayload, setExpiredPayload] = useState<string | null>(null);
  const [displayMs, setDisplayMs] = useState(remainingMs);

  useEffect(() => {
    setDisplayMs(remainingMs);
    // Display fence + live 1s ticker; native elapsed time remains the authorization authority.
    const expireTimer = window.setTimeout(() => setExpiredPayload(payload), Math.max(0, remainingMs));
    const tick = window.setInterval(() => setDisplayMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => {
      window.clearTimeout(expireTimer);
      window.clearInterval(tick);
    };
  }, [payload, remainingMs]);

  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' });
      const n = qr.modules.size;
      const cells: [number, number][] = [];
      const pad = Math.max(2, Math.round(n * 0.11));
      const mid = (n - 1) / 2;
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const inCenter = Math.abs(x - mid) <= pad && Math.abs(y - mid) <= pad;
          if (!isFinder(x, y, n) && !inCenter && qr.modules.get(y, x)) {
            cells.push([x, y]);
          }
        }
      }
      return { n, cells };
    } catch {
      return null;
    }
  }, [payload]);

  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x} y={y} width={7} height={7} rx={1.6} fill="var(--text-primary)" />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={1.0} fill="var(--surface-1)" />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.65} fill="var(--text-primary)" />
    </g>
  );

  if (expiredPayload === payload) {
    return (
      <div className="pairing-qr-stage">
        <p className="pairing-attention" role="status">
          {t('pairing.qrUnavailable')}
        </p>
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="pairing-qr-stage">
        <div className="pairing-qr-placeholder" role="alert">
          <QrCode aria-hidden="true" size={40} />
          <p>{t('pairing.qrFailed')}</p>
        </div>
      </div>
    );
  }

  const { n, cells } = matrix;
  const logoSpan = n * 0.24;
  const logoOffset = (n - logoSpan) / 2;
  const scale = logoSpan / 120;

  return (
    <div className="my-5 space-y-3">
      <div className="pairing-qr-stage !my-0">
        <svg aria-label={t('pairing.qrAlt')} className="pairing-qr-image" role="img" viewBox={`-1.5 -1.5 ${n + 3} ${n + 3}`}>
          <rect x={-1.5} y={-1.5} width={n + 3} height={n + 3} rx={2.2} fill="var(--surface-1)" />
          {cells.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x + 0.09} y={y + 0.09} width={0.82} height={0.82} rx={0.22} fill="var(--text-primary)" />
          ))}
          <Finder x={0} y={0} />
          <Finder x={n - 7} y={0} />
          <Finder x={0} y={n - 7} />
          <g transform={`translate(${logoOffset} ${logoOffset}) scale(${scale})`}>
            <rect width={120} height={120} rx={26} fill="var(--tile)" />
            <circle
              cx={60}
              cy={60}
              r={26}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray="122 41"
              transform="rotate(-90 60 60)"
              fill="none"
              stroke="var(--tile-ring)"
            />
            <circle cx={60} cy={60} r={7} fill="var(--brand-base)" />
          </g>
        </svg>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-2/40 px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-secondary-text">
          <Clock aria-hidden="true" size={14} />
          {t('ui.countdown')}
        </span>
        <span className="font-semibold tabular-nums text-primary-text">{formatCountdown(displayMs)}</span>
      </div>
    </div>
  );
}
