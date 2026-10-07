import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

let transporter: Transporter | null = null;
let config: SmtpConfig | null = null;

function buildConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `KMFRI System <${user}>`;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  config = buildConfig();
  if (!config) {
    console.warn('[email] SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  });

  transporter.verify((err) => {
    if (err) {
      console.error('[email] SMTP connection failed:', err.message);
    } else {
      console.log('[email] SMTP server ready');
    }
  });

  return transporter;
}

export interface EmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  type?:
    | 'SYSTEM'
    | 'PASSWORD_RESET'
    | 'WELCOME'
    | 'NOTIFICATION'
    | 'REPORT_REMINDER'
    | 'APPROVAL'
    | 'CUSTOM'
    | 'LOGIN_ALERT'
    | 'PASSWORD_RESET_CODE'
    | 'PASSWORD_RESET_CONFIRMATION'
    | 'PASSWORD_CHANGED'
    | 'PROFILE_UPDATED';
}

export async function sendEmail(params: EmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const tx = getTransporter();
  if (!tx) {
    return { success: false, error: 'SMTP not configured' };
  }

  const mailOptions: SendMailOptions = {
    from: config!.from,
    to: `${params.toName ? `${params.toName} <${params.to}>` : params.to}`,
    subject: params.subject,
    html: params.html,
    text: params.text,
    headers: {
      'X-KMFRI-Email-Type': params.type || 'CUSTOM',
    },
  };

  try {
    const info = await tx.sendMail(mailOptions);
    console.log(`[email] Sent to ${params.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[email] Failed to send to ${params.to}:`, err.message);
    return { success: false, error: err.message };
  }
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}