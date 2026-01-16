/**
 * Script para generar un token de reset de contraseña para pruebas
 * Ejecuta: npx ts-node scripts/test-reset-password.ts <email>
 * Ejemplo: npx ts-node scripts/test-reset-password.ts usuario@ejemplo.com
 */
import { prisma } from '../src/utils/prisma';
import { generateResetToken, calculateResetTokenExpiry } from '../src/utils/auth-helpers';

async function testResetPassword() {
  try {
    // Obtener email del argumento de línea de comandos o usar uno por defecto
    const email = process.argv[2] || 'admin@ejemplo.com';
    
    console.log(' Buscando usuario:', email);
    
    // Verificar que el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
      },
    });

    if (!usuario) {
      console.error(' Error: Usuario no encontrado con el email:', email);
      console.log('\n Usuarios disponibles en la base de datos:');
      const usuarios = await prisma.usuario.findMany({
        select: { email: true, nombreCompleto: true },
        take: 10,
      });
      usuarios.forEach(u => {
        console.log(`   - ${u.email} (${u.nombreCompleto})`);
      });
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(' Usuario encontrado:', usuario.nombreCompleto);
    console.log(' Email:', usuario.email);
    console.log('\n Generando token de reset...\n');

    // Generar token
    const { token, hashedToken } = generateResetToken();
    const resetTokenExpiry = calculateResetTokenExpiry();

    // Actualizar usuario con el token
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    console.log(' Token generado y guardado en la base de datos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n Token de reset:', token);
    console.log('\n URL de reset:', resetUrl);
    console.log('\n Copia este token o URL para resetear la contraseña');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error(' Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testResetPassword();