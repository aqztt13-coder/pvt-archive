import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('تعذر استخراج رمز الوصول من Google');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Helper to base64url encode utf-8 string
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Dispatches a real password reset email via Google Workspace Gmail REST API
export async function sendGmailPasswordReset(
  targetEmail: string,
  resetUrl: string,
  token: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const subject = 'إعادة تعيين كلمة المرور | شعبة الموائع المكمنية - PVT System';

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background-color: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px 28px; line-height: 1.7; font-size: 14px; color: #334155; }
    .btn-wrapper { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25); }
    .link-box { word-break: break-all; background-color: #f1f5f9; padding: 14px; border-radius: 10px; font-size: 12px; font-family: monospace; color: #475569; margin-top: 16px; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .notice { font-size: 12px; color: #b45309; background-color: #fef3c7; border: 1px solid #fde68a; padding: 12px; border-radius: 10px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>نظام تحليل الموائع المكمنية</h1>
      <p>شعبة الموائع المكمنية | Reservoir Fluids Division</p>
    </div>
    <div class="content">
      <p>مرحباً،</p>
      <p>لقد تم طلب إعادة تعيين كلمة المرور الخاصة بحسابك: <strong>${targetEmail}</strong>.</p>
      <p>لتعيين كلمة مرور جديدة وآمنة، يرجى النقر على الزر أدناه:</p>
      
      <div class="btn-wrapper">
        <a href="${resetUrl}" class="btn" target="_blank">إعادة تعيين كلمة المرور الآن</a>
      </div>

      <div class="notice">
        <strong>تنبيه أمان:</strong> هذا الرابط فريد ومؤقت وصالح للاستخدام <strong>لمرة واحدة فقط</strong> خلال 60 دقيقة. بعد استخدامه سيبطل مفعول الرابط تلقائياً.
      </div>

      <p style="margin-top: 24px; font-size: 13px;">إذا لم تتمكن من الضغط على الزر، يمكنك نسخ الرابط التالي ولصقه في متصفحك:</p>
      <div class="link-box">${resetUrl}</div>

      <p style="margin-top: 24px; font-size: 12px; color: #64748b;">إذا لم تكن أنت من طلب إعادة التعيين، يمكنك تجاهل هذه الرسالة بأمان وستظل كلمة مرورك السابقة كما هي دون تغيير.</p>
    </div>
    <div class="footer">
      &copy; شعبة الموائع المكمنية - نظام السجلات الرقمية PVT
    </div>
  </div>
</body>
</html>
    `.trim();

    // Compose RFC 2822 Message
    const emailMime = [
      `To: ${targetEmail}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(htmlContent))),
    ].join('\r\n');

    const raw = base64UrlEncode(emailMime);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('Real email dispatched successfully via Gmail API. ID:', data.id);
      return { success: true, messageId: data.id };
    } else {
      console.error('Gmail API send error:', data);
      return { success: false, error: data.error?.message || 'فشل إرسال البريد عبر Gmail' };
    }
  } catch (err: any) {
    console.error('sendGmailPasswordReset error:', err);
    return { success: false, error: err.message };
  }
}
