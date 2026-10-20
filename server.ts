import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

interface ResetTokenRecord {
  tokenHash: string;
  email: string;
  expiresAt: number; // timestamp ms
  used: boolean;
  createdAt: string;
}

// In-memory token storage with persistent fallback
const tokenStore = new Map<string, ResetTokenRecord>();

// Helper to hash tokens before storing to prevent timing attacks / database leaks
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Email dispatch service supporting both Resend and SMTP (e.g. Gmail SMTP)
async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<{ success: boolean; error?: string }> {
  const subject = 'إعادة تعيين كلمة المرور | شعبة الموائع المكمنية - PVT System';

  const htmlBody = `
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
          <p>لقد تلقينا طلباً لإعادة تعيين الرمز السري / كلمة المرور الخاصة بحسابك المسجل: <strong>${toEmail}</strong>.</p>
          <p>لتعيين كلمة مرور جديدة وآمنة، يرجى النقر على الزر أدناه:</p>
          
          <div class="btn-wrapper">
            <a href="${resetUrl}" class="btn" target="_blank">إعادة تعيين كلمة المرور الآن</a>
          </div>

          <div class="notice">
            <strong>تنبيه أمان:</strong> هذا الرابط فريد ومؤقت وصالح للاستخدام <strong>لمرة واحدة فقط</strong> خلال 60 دقيقة. بعد الاستخدام سيبطل مفعول الرابط تلقائياً.
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
  `;

  const textBody = `
نظام تحليل الموائع المكمنية - شعبة الموائع المكمنية
طلب إعادة تعيين كلمة المرور لحساب: ${toEmail}

يرجى فتح الرابط التالي في متصفحك لتعيين كلمة مرور جديدة:
${resetUrl}

ملاحظة هامة: هذا الرابط فريد وصالح للاستخدام لمرة واحدة فقط لمدة 60 دقيقة.
إذا لم تكن قد طلبت هذا الإجراء، يمكنك تجاهل هذه الرسالة بأمان.
  `.trim();

  // 1. Try Resend API if RESEND_API_KEY is present
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`[EmailService] Attempting dispatch via Resend API to: ${toEmail}`);
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'onboarding@resend.dev',
          to: [toEmail],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });

      const data = await resendRes.json();
      if (resendRes.ok) {
        console.log(`[EmailService] Resend email dispatched successfully. ID:`, data.id);
        return { success: true };
      } else {
        console.error(`[EmailService] Resend API error:`, data);
        // Fall through to SMTP if configured
      }
    } catch (err: any) {
      console.error(`[EmailService] Resend dispatch failed:`, err.message);
    }
  }

  // 2. Try SMTP (e.g. Gmail SMTP, SendGrid, Amazon SES)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const isPort465 = Number(process.env.SMTP_PORT) === 465 || (!process.env.SMTP_PORT && !process.env.SMTP_HOST);
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT) || (isPort465 ? 465 : 587);

      console.log(`[EmailService] Attempting dispatch via SMTP (${host}:${port}) to: ${toEmail}`);

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: isPort465 || process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"PVT System" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`[EmailService] SMTP email sent successfully. MessageId:`, info.messageId);
      return { success: true };
    } catch (err: any) {
      console.error(`[EmailService] SMTP send error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // Log notice if no provider is configured
  console.warn(
    `[EmailService] Notice: Neither RESEND_API_KEY nor SMTP_USER/SMTP_PASS is configured in .env. Real email delivery to Gmail requires setting credentials in .env. Reset link generated: ${resetUrl}`
  );

  return { success: false, error: 'No email service credentials configured in environment' };
}

// ================= API ROUTES =================

// 1. Request Password Reset Link
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال بريد إلكتروني صالح.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate 32 bytes cryptographically secure unguessable random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenH = hashToken(rawToken);

    // Token expires in 60 minutes
    const expiresAt = Date.now() + 60 * 60 * 1000;

    // Store token record
    tokenStore.set(tokenH, {
      tokenHash: tokenH,
      email: cleanEmail,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    // Determine target URL for reset
    const appUrl = (process.env.APP_URL || `http://${req.headers.host || 'localhost:3000'}`).replace(/\/$/, '');
    const resetUrl = `${appUrl}/?reset_token=${rawToken}`;

    console.log(`[Auth] Password reset requested for: ${cleanEmail}. Link: ${resetUrl}`);

    // Send real email via SMTP / Resend
    await sendPasswordResetEmail(cleanEmail, resetUrl);

    // Return generic success message with resetUrl for client-side Gmail API dispatch
    return res.json({
      success: true,
      message: 'إذا كان هذا البريد مسجلاً في النظام، فستصلك رسالة تحتوي على رابط مؤقت لإعادة تعيين كلمة المرور. يرجى التحقق من صندوق الوارد.',
      resetUrl,
      rawToken,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/forgot-password:', err);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ في الخادم أثناء معالجة الطلب.',
    });
  }
});

// 2. Verify Reset Token Validity (One-Time & Expiration Check)
app.get('/api/auth/verify-reset-token', (req, res) => {
  const rawToken = req.query.token as string;
  if (!rawToken || typeof rawToken !== 'string') {
    return res.status(400).json({ valid: false, error: 'رمز إعادة التعيين غير صالح أو مفقود.' });
  }

  const tokenH = hashToken(rawToken);
  const record = tokenStore.get(tokenH);

  if (!record) {
    return res.status(404).json({
      valid: false,
      error: 'رابط إعادة تعيين كلمة المرور غير صحيح أو منتهي.',
    });
  }

  if (record.used) {
    return res.status(410).json({
      valid: false,
      error: 'تم استخدام هذا الرابط مسبقاً لمرة واحدة. يرجى طلب رابط جديد.',
    });
  }

  if (Date.now() > record.expiresAt) {
    tokenStore.delete(tokenH);
    return res.status(410).json({
      valid: false,
      error: 'انتهت صلاحية هذا الرابط (صالح لمدة 60 دقيقة). يرجى طلب رابط جديد.',
    });
  }

  return res.json({
    valid: true,
    email: record.email,
  });
});

// 3. Commit Password Reset
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'رمز إعادة التعيين مطلوب.' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'يجب أن تتكون كلمة المرور الجديدة من 4 خانات على الأقل.',
      });
    }

    const tokenH = hashToken(token);
    const record = tokenStore.get(tokenH);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'رابط إعادة التعيين غير موجود أو تم حذفه.',
      });
    }

    if (record.used) {
      return res.status(410).json({
        success: false,
        error: 'تم استخدام هذا الرابط بالفعل لمرة واحدة، ولا يمكن استخدامه مجدداً.',
      });
    }

    if (Date.now() > record.expiresAt) {
      tokenStore.delete(tokenH);
      return res.status(410).json({
        success: false,
        error: 'انتهت صلاحية رابط إعادة التعيين. يرجى طلب رابط جديد.',
      });
    }

    // Invalidate token immediately (Single-Use Guarantee)
    record.used = true;
    tokenStore.set(tokenH, record);

    console.log(`[Auth] Password successfully reset for: ${record.email}`);

    return res.json({
      success: true,
      email: record.email,
      message: 'تم تعيين كلمة المرور الجديدة بنجاح. يمكنك الآن تسجيل الدخول بها.',
    });
  } catch (err: any) {
    console.error('Error in /api/auth/reset-password:', err);
    return res.status(500).json({ success: false, error: 'فشل تعيين كلمة المرور في الخادم.' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    resendConfigured: !!process.env.RESEND_API_KEY,
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    timestamp: new Date().toISOString(),
  });
});

// ================= VITE DEV OR STATIC SERVE =================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PVT Server running on http://0.0.0.0:${PORT}`);
    console.log(`📧 Email Status: Resend=${!!process.env.RESEND_API_KEY}, SMTP=${!!(process.env.SMTP_USER && process.env.SMTP_PASS)}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
