/**
 * Servicio simplificado de envío de emails: configuración, templates y envío.
 * Soporta SMTP y Ethereal Email para desarrollo.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { env } from '../config/env';

let transporter: Transporter | null = null;
let etherealUser: string | null = null;

/**
 * Obtiene la configuración de email desde variables de entorno
 */
const getEmailConfig = () => {
  return {
    host: process.env.EMAIL_HOST,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME || 'Sistema Kanban',
  };
};

//para desarrollo
const createEtherealTransporter = async (): Promise<Transporter> => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealUser = testAccount.user;
    const etherealTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    logger.info('Cuenta de prueba Ethereal Email creada', {
      user: testAccount.user,
    });
    return etherealTransporter;
  } catch (error) {
    logger.error('Error al crear cuenta de prueba Ethereal', error);
    throw new Error('No se pudo configurar el servicio de email');
  }
};

/**
 * Crea un transporter usando configuración SMTP
 */
const createSMTPTransporter = (config: ReturnType<typeof getEmailConfig>): Transporter => {
  return nodemailer.createTransport({
    host: config.host!,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user!,
      pass: config.pass!,
    },
  });
};

/**
 * Obtiene o crea el transporter de email
 * Usa SMTP si está configurado, sino usa Ethereal Email
 */
const getTransporter = async (): Promise<Transporter> => {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfig();

  if (!config.host || !config.user || !config.pass) {
    logger.warn('No se encontró configuración de email. Usando Ethereal Email para desarrollo.', {
      hasEmailHost: !!config.host,
      hasEmailUser: !!config.user,
      hasEmailPass: !!config.pass,
    });
    
    transporter = await createEtherealTransporter();
    return transporter;
  }

  transporter = createSMTPTransporter(config);
  return transporter;
};

const getFromEmail = (): string => {
  return etherealUser || getEmailConfig().from || getEmailConfig().user || 'noreply@kanban.local';
};


const getFromName = (): string => {
  return getEmailConfig().fromName;
};

const loadTemplate = (templateName: string, extension: 'html' | 'txt'): string => {
  const templatePath = join(process.cwd(), 'src', 'templates', 'emails', `${templateName}.${extension}`);
  return readFileSync(templatePath, 'utf-8');
};

const replaceTemplateVariables = (
  template: string,
  variables: Record<string, string>
): string => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
};

const showEmailPreview = (info: nodemailer.SentMessageInfo, isEthereal: boolean): void => {
  if (!env.isDevelopment && !isEthereal) {
    return;
  }
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (!previewUrl) {
    return;
  }
  
  // Mostrar URL de Ethereal de forma simple y directa con console.log
  if (isEthereal && previewUrl) {
    console.log('\n');
    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log(' EMAIL DE PRUEBA (Ethereal Email)');
    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log(' ABRE ESTE ENLACE EN TU NAVEGADOR:');
    console.log(previewUrl);
    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log('\n');
  }
  
  logger.info('Preview URL de email (Ethereal) - Abre este enlace para ver el email:', { previewUrl });
};

export const sendPasswordResetEmail = async (
  to: string,
  fullName: string,
  resetToken: string
): Promise<void> => {
  const transport = await getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Cargar templates
  const htmlTemplate = loadTemplate('password-reset', 'html');
  const textTemplate = loadTemplate('password-reset', 'txt');

  const variables = {
    FULL_NAME: fullName,
    RESET_URL: resetUrl,
  };

  const fromEmail = getFromEmail();
  const fromName = getFromName();
  const isEthereal = !process.env.EMAIL_HOST;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Recuperación de contraseña - Sistema Kanban',
    html: replaceTemplateVariables(htmlTemplate, variables),
    text: replaceTemplateVariables(textTemplate, variables),
  };

  try {
    const info = await transport.sendMail(mailOptions);
    logger.info('Email de recuperación enviado', {
      messageId: info.messageId,
      to,
    });
    
    // Mostrar preview URL de forma destacada
    // Verificar que isEthereal es true antes de mostrar
    if (isEthereal) {
      logger.info('DEBUG: isEthereal es true, mostrando preview URL destacada');
    }
    showEmailPreview(info, isEthereal);
  } catch (error) {
    logger.error('Error al enviar email de recuperación', error, { to });
    throw new Error('No se pudo enviar el email de recuperación');
  }
};
