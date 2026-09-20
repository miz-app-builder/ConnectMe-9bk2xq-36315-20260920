import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, TextInput, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { updateProfile } from '@/services/profileService';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS, SPACING, RADIUS, COLORS } from '@/constants/theme';

type Mode = 'login' | 'signup' | 'otp' | 'forgot';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email address';
    if (mode !== 'forgot') {
      if (!password) errs.password = 'Password is required';
      else if (password.length < 6) errs.password = 'At least 6 characters';
    }
    if (mode === 'signup') {
      if (!displayName.trim()) errs.displayName = 'Name is required';
      if (password !== confirm) errs.confirm = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) showAlert('Login Failed', error);
  };

  const handleSignup = async () => {
    if (!validate()) return;
    const { error } = await sendOTP(email.trim());
    if (error) {
      showAlert('Sign Up Failed', error);
      return;
    }
    setOtpDigits(['', '', '', '']);
    setResendCooldown(60);
    setMode('otp');
    setTimeout(() => otpRefs[0].current?.focus(), 300);
  };

  const handleVerifyOTP = async () => {
    const otp = otpDigits.join('');
    if (otp.length < 4) {
      showAlert('Invalid Code', 'Please enter the 4-digit code sent to your email.');
      return;
    }
    setOtpLoading(true);
    const { error, user } = await verifyOTPAndLogin(email.trim(), otp, { password });
    setOtpLoading(false);
    if (error) {
      showAlert('Verification Failed', error);
      setOtpDigits(['', '', '', '']);
      otpRefs[0].current?.focus();
      return;
    }
    if (user && displayName.trim()) {
      await updateProfile(user.id, { display_name: displayName.trim() });
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    const { error } = await sendOTP(email.trim());
    if (error) { showAlert('Error', error); return; }
    setResendCooldown(60);
    setOtpDigits(['', '', '', '']);
    otpRefs[0].current?.focus();
    showAlert('Code Sent', 'A new verification code was sent to your email.');
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 3) otpRefs[index + 1].current?.focus();
    if (digit && index === 3) {
      // Auto-submit when last digit entered
      const otp = [...next].join('');
      if (otp.length === 4) {
        setOtpLoading(true);
        verifyOTPAndLogin(email.trim(), otp, { password }).then(async ({ error, user }) => {
          setOtpLoading(false);
          if (error) {
            showAlert('Verification Failed', error);
            setOtpDigits(['', '', '', '']);
            otpRefs[0].current?.focus();
            return;
          }
          if (user && displayName.trim()) {
            await updateProfile(user.id, { display_name: displayName.trim() });
          }
        });
      }
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setErrors({ email: 'Enter your email first' });
      return;
    }
    setForgotLoading(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setForgotLoading(false);
    if (error) {
      showAlert('Error', error.message);
    } else {
      setForgotSent(true);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setForgotSent(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroWrapper}>
          <Image
            source={require('@/assets/images/login-hero.png')}
            style={styles.heroImage}
            contentFit="cover"
          />
          <View style={[styles.heroOverlay, { backgroundColor: colors.overlay }]} />
          <View style={styles.heroBrand}>
            <Text style={styles.heroTitle}>ConnectMe</Text>
            <Text style={styles.heroSub}>Private messaging for friends & family</Text>
          </View>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : '#000' }]}>
          {/* Tab switcher */}
          {mode !== 'forgot' && mode !== 'otp' && (
            <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
              {(['login', 'signup'] as Mode[]).map(m => (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[styles.tab, mode === m && { backgroundColor: colors.card }]}
                >
                  <Text style={[styles.tabLabel, { color: mode === m ? COLORS.primary : colors.textSecondary }]}>
                    {m === 'login' ? 'Log In' : 'Sign Up'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {mode === 'otp' ? (
            <View style={styles.otpContainer}>
              <Pressable onPress={() => switchMode('signup')} style={styles.backRow}>
                <Text style={[styles.backText, { color: COLORS.primary }]}>← Back</Text>
              </Pressable>
              <Text style={styles.otpIcon}>🔐</Text>
              <Text style={[styles.sectionTitle, { color: colors.text, textAlign: 'center' }]}>Verify your email</Text>
              <Text style={[styles.otpSubtitle, { color: colors.textSecondary }]}>
                Enter the 4-digit code sent to{' '}
                <Text style={{ color: COLORS.primary, fontWeight: FONTS.weights.semiBold }}>{email}</Text>
              </Text>

              {/* OTP Digit Boxes */}
              <View style={styles.otpRow}>
                {otpDigits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={otpRefs[i]}
                    value={digit}
                    onChangeText={v => handleOtpChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: digit ? COLORS.primary : colors.border,
                        color: colors.text,
                      },
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!otpLoading}
                    accessibilityLabel={`OTP digit ${i + 1}`}
                  />
                ))}
              </View>

              <Button
                label="Verify & Create Account"
                onPress={handleVerifyOTP}
                loading={otpLoading}
                style={{ marginTop: SPACING.lg }}
              />

              <View style={styles.resendRow}>
                <Text style={[styles.resendLabel, { color: colors.textSecondary }]}>Didn't receive a code? </Text>
                <Pressable onPress={handleResendOTP} disabled={resendCooldown > 0}>
                  <Text style={[styles.resendBtn, { color: resendCooldown > 0 ? colors.textMuted : COLORS.primary }]}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : mode === 'forgot' ? (
            <View>
              <Pressable onPress={() => switchMode('login')} style={styles.backRow}>
                <Text style={[styles.backText, { color: COLORS.primary }]}>← Back to login</Text>
              </Pressable>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Reset Password</Text>
              {forgotSent ? (
                <Text style={[styles.sentMsg, { color: colors.success }]}>
                  A reset link has been sent to your email. Check your inbox.
                </Text>
              ) : (
                <>
                  <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    error={errors.email}
                    colors={colors}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="your@email.com"
                  />
                  <Button
                    label="Send Reset Link"
                    onPress={handleForgot}
                    loading={forgotLoading}
                    style={{ marginTop: SPACING.sm }}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={{ gap: 0 }}>
              {mode === 'signup' && (
                <Input
                  label="Full Name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  error={errors.displayName}
                  colors={colors}
                  placeholder="Your name"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              )}
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                colors={colors}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="your@email.com"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Input
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                colors={colors}
                secureTextEntry
                placeholder="••••••••"
                returnKeyType={mode === 'signup' ? 'next' : 'done'}
                onSubmitEditing={() => mode === 'signup' ? confirmRef.current?.focus() : handleLogin()}
              />
              {mode === 'signup' && (
                <Input
                  ref={confirmRef}
                  label="Confirm Password"
                  value={confirm}
                  onChangeText={setConfirm}
                  error={errors.confirm}
                  colors={colors}
                  secureTextEntry
                  placeholder="••••••••"
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
              )}
              {mode === 'login' && (
                <Pressable onPress={() => switchMode('forgot')} style={styles.forgotRow}>
                  <Text style={[styles.forgotText, { color: COLORS.primary }]}>Forgot password?</Text>
                </Pressable>
              )}
              <Button
                label={mode === 'login' ? 'Log In' : 'Create Account'}
                onPress={mode === 'login' ? handleLogin : handleSignup}
                loading={operationLoading}
                style={{ marginTop: SPACING.md }}
              />
            </View>
          )}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Your messages are private and secure
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  heroWrapper: {
    width: '100%',
    height: 220,
    overflow: 'hidden',
    marginBottom: -RADIUS.xl,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBrand: {
    position: 'absolute',
    bottom: SPACING.xxxl,
    left: SPACING.xxl,
  },
  heroTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  card: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 10,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: SPACING.xl,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.lg,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: SPACING.xs,
  },
  forgotText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
  },
  backRow: {
    marginBottom: SPACING.lg,
  },
  backText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
  },
  otpContainer: {
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  otpIcon: {
    fontSize: 44,
    marginTop: SPACING.sm,
  },
  otpSubtitle: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  otpRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'center',
  },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    fontSize: 28,
    fontWeight: FONTS.weights.bold,
    textAlign: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resendLabel: {
    fontSize: FONTS.sizes.sm,
  },
  resendBtn: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
  },
  sentMsg: {
    fontSize: FONTS.sizes.md,
    lineHeight: 22,
    textAlign: 'center',
    marginVertical: SPACING.lg,
  },
  footer: {
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.xxl,
  },
});
