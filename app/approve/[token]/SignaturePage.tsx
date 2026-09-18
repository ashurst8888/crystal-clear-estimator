'use client';

import { useRef, useState, useEffect } from 'react';

interface SignaturePageProps {
  token: string;
  clientName: string;
  invNum: string;
  total: string;
  date: string;
  alreadySigned: boolean;
  signedAt?: string;
}

export function SignaturePage({ token, clientName, invNum, total, date, alreadySigned, signedAt }: SignaturePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(alreadySigned);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function handleConsentChange(checked: boolean) {
    setConsentGiven(checked);
    if (checked) setConsentTimestamp(new Date().toISOString());
    else setConsentTimestamp(null);
  }

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setDrawing(true);
    setHasSignature(true);
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSubmit() {
    if (!hasSignature || !consentGiven) return;
    setSubmitting(true);
    setError('');
    try {
      const canvas = canvasRef.current!;
      const signature = canvas.toDataURL('image/png');
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signature, consentTimestamp }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = hasSignature && consentGiven && !submitting;

  if (submitted) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', maxWidth: '480px', width: '100%', overflow: 'hidden' }}>
          <div style={{ background: '#4DA8DA', padding: '28px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
            <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {alreadySigned ? 'Already Signed' : 'Estimate Signed!'}
            </h1>
          </div>
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', color: '#111827', fontWeight: '600', marginTop: 0 }}>
              Thank you{clientName ? `, ${clientName}` : ''}!
            </p>
            <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6' }}>
              {alreadySigned
                ? `This estimate was already signed${signedAt ? ' on ' + new Date(signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}. We have your signature on file.`
                : 'Your signature has been recorded. Crystal Clear Cleaning & Contracting will be in touch shortly to get started.'}
            </p>
            {(invNum || total) && (
              <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '16px', margin: '24px 0', textAlign: 'left' }}>
                {clientName && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Client</span><span style={{ fontWeight: '600', fontSize: '14px' }}>{clientName}</span></div>}
                {invNum && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Estimate</span><span style={{ fontWeight: '600', fontSize: '14px' }}>{invNum}</span></div>}
                {total && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: date ? '8px' : '0' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Total</span><span style={{ fontWeight: '700', fontSize: '16px', color: '#4DA8DA' }}>{total}</span></div>}
                {date && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Date</span><span style={{ fontWeight: '600', fontSize: '14px' }}>{date}</span></div>}
              </div>
            )}
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: 0 }}>
              Questions? Call us at{' '}
              <a href="tel:5136148080" style={{ color: '#4DA8DA', fontWeight: '600', textDecoration: 'none' }}>(513) 614-8080</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f3f4f6', padding: '24px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ background: '#4DA8DA', borderRadius: '16px 16px 0 0', padding: '24px 28px' }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Crystal Clear Cleaning &amp; Contracting</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontSize: '14px' }}>Please review and sign your estimate</p>
        </div>

        <div style={{ background: 'white', borderRadius: '0 0 16px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '28px' }}>
          {/* Estimate summary */}
          {(invNum || total || date || clientName) && (
            <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
              {clientName && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Client</span><span style={{ fontWeight: '600', fontSize: '14px' }}>{clientName}</span></div>}
              {invNum && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Estimate</span><span style={{ fontWeight: '600', fontSize: '14px' }}>{invNum}</span></div>}
              {total && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: date ? '8px' : '0' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Total</span><span style={{ fontWeight: '700', fontSize: '18px', color: '#4DA8DA' }}>{total}</span></div>}
              {date && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280', fontSize: '14px' }}>Date</span><span style={{ fontWeight: '600', fontSize: '14px' }}>{date}</span></div>}
            </div>
          )}

          {/* Consent checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: '24px', padding: '14px', background: consentGiven ? '#f0f9ff' : '#f9fafb', borderRadius: '10px', border: `1.5px solid ${consentGiven ? '#4DA8DA' : '#e5e7eb'}`, transition: 'all 0.15s' }}>
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={e => handleConsentChange(e.target.checked)}
              style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#4DA8DA', flexShrink: 0 }}
            />
            <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
              I agree to sign this estimate electronically and agree to its terms.
            </span>
          </label>

          {/* Signature pad */}
          <p style={{ fontWeight: '600', color: '#111827', marginTop: 0, marginBottom: '8px', fontSize: '15px' }}>
            Sign below with your finger
          </p>
          <div style={{ border: `2px solid ${hasSignature ? '#4DA8DA' : '#e5e7eb'}`, borderRadius: '10px', overflow: 'hidden', background: '#fafafa', position: 'relative', transition: 'border-color 0.15s' }}>
            <canvas
              ref={canvasRef}
              width={860}
              height={320}
              style={{ display: 'block', width: '100%', height: '160px', touchAction: 'none', cursor: 'crosshair' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasSignature && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ color: '#d1d5db', fontSize: '15px' }}>Sign here</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>Draw your signature above</span>
            <button onClick={clearCanvas} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer', padding: '4px 8px' }}>Clear</button>
          </div>

          {!consentGiven && hasSignature && (
            <p style={{ color: '#f59e0b', fontSize: '13px', marginTop: '10px', marginBottom: 0 }}>Please check the consent box above before submitting.</p>
          )}

          {error && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px' }}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              display: 'block', width: '100%', marginTop: '20px',
              background: canSubmit ? '#4DA8DA' : '#d1d5db',
              color: 'white', border: 'none', borderRadius: '10px',
              padding: '16px', fontSize: '17px', fontWeight: 'bold',
              cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Signature'}
          </button>

          <p style={{ color: '#9ca3af', fontSize: '11px', textAlign: 'center', marginTop: '12px', marginBottom: 0, lineHeight: '1.5' }}>
            Your IP address, device info, and the time of signing are recorded as part of the legal audit trail. This constitutes a legally binding electronic signature under the federal E-SIGN Act and Ohio UETA (ORC 1306).
          </p>
        </div>
      </div>
    </div>
  );
}
