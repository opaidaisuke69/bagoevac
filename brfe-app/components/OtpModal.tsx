import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CODE_LENGTH = 6;

type Props = {
  visible: boolean;
  email: string;
  /** Called with the entered code; return an error string to show, or null on success. */
  onSubmit: (code: string) => Promise<string | null>;
  /** Called when the user taps "Resend". Return an error string or null. */
  onResend: () => Promise<string | null>;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Seconds to wait before resend is allowed again (matches backend cooldown). */
  resendCooldown?: number;
};

/**
 * A focused 6-digit code entry modal used for both email verification during
 * registration and password reset. Handles a resend countdown, inline errors,
 * and a submitting state.
 */
export default function OtpModal({
  visible, email, onSubmit, onResend, onClose,
  title = 'Verify your email',
  subtitle,
  resendCooldown = 60,
}: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(resendCooldown);
  const inputRef = useRef<TextInput>(null);
  // Synchronous guard against duplicate submits (auto-submit + button tap can
  // race before the `submitting` state flips).
  const inFlight = useRef(false);

  // Reset state whenever the modal opens.
  useEffect(() => {
    if (visible) {
      setCode('');
      setError('');
      setCountdown(resendCooldown);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, resendCooldown]);

  // Resend countdown ticker.
  useEffect(() => {
    if (!visible || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [visible, countdown]);

  // Auto-submit once all digits are entered.
  useEffect(() => {
    if (code.length === CODE_LENGTH && !submitting) {
      handleSubmit(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleSubmit(value: string) {
    if (inFlight.current || value.length !== CODE_LENGTH) return;
    inFlight.current = true;
    Keyboard.dismiss();
    setSubmitting(true);
    setError('');
    try {
      const err = await onSubmit(value);
      if (err) { setError(err); setCode(''); setTimeout(() => inputRef.current?.focus(), 150); }
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const err = await onResend();
      if (err) setError(err);
      else setCountdown(resendCooldown);
    } finally {
      setResending(false);
    }
  }

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.grip} />

          <View style={s.iconCircle}>
            <Ionicons name="mail-open-outline" size={28} color="#1d4ed8" />
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>
            {subtitle ?? 'Enter the 6-digit code we sent to'}
          </Text>
          <Text style={s.email}>{email}</Text>

          {/* Hidden input drives the boxes */}
          <TouchableOpacity activeOpacity={1} style={s.boxesRow} onPress={() => inputRef.current?.focus()}>
            {digits.map((d, i) => {
              const active = i === code.length;
              return (
                <View key={i} style={[s.box, active && s.boxActive, !!d && s.boxFilled]}>
                  <Text style={s.boxText}>{d}</Text>
                </View>
              );
            })}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            style={s.hiddenInput}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            editable={!submitting}
          />

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.verifyBtn, (submitting || code.length < CODE_LENGTH) && s.verifyBtnDisabled]}
            onPress={() => handleSubmit(code)}
            disabled={submitting || code.length < CODE_LENGTH}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.verifyBtnText}>Verify</Text>}
          </TouchableOpacity>

          <View style={s.resendRow}>
            {countdown > 0 ? (
              <Text style={s.resendMuted}>Resend code in {countdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={s.resendLink}>{resending ? 'Sending…' : 'Resend code'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={s.cancel} onPress={onClose} disabled={submitting}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 32, alignItems: 'center' },
  grip:         { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', marginBottom: 18 },
  iconCircle:   { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title:        { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  subtitle:     { fontSize: 13.5, color: '#64748b', marginTop: 6, textAlign: 'center' },
  email:        { fontSize: 14, color: '#1d4ed8', fontWeight: '700', marginTop: 2, marginBottom: 20 },
  boxesRow:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  box:          { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  boxActive:    { borderColor: '#1d4ed8', backgroundColor: '#fff' },
  boxFilled:    { borderColor: '#93c5fd', backgroundColor: '#fff' },
  boxText:      { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  hiddenInput:  { position: 'absolute', opacity: 0, height: 1, width: 1 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12, alignSelf: 'stretch' },
  errorText:    { flex: 1, color: '#dc2626', fontSize: 13, fontWeight: '500' },
  verifyBtn:    { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center', alignSelf: 'stretch', marginTop: 20, elevation: 3, shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8 },
  verifyBtnDisabled: { backgroundColor: '#93c5fd', elevation: 0 },
  verifyBtnText:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  resendRow:    { marginTop: 16, minHeight: 20 },
  resendMuted:  { fontSize: 13.5, color: '#94a3b8' },
  resendLink:   { fontSize: 13.5, color: '#2563eb', fontWeight: '700' },
  cancel:       { marginTop: 12, padding: 8 },
  cancelText:   { fontSize: 14, color: '#64748b', fontWeight: '600' },
});
