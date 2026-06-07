/**
 * Prisma seed script — creates dev data for Hess Solutions.
 * Run with: npx ts-node prisma/seed.ts
 * Or via: npm run prisma:seed
 *
 * This seeds:
 *  - 1 Tenant: Hess Solutions
 *  - 1 Super Admin dev user
 *  - 1 Admin dev user
 *  - 2 Operator dev users
 *  - 3 sample customers
 *  - 5 sample jobs across departments
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'hess-solutions' },
    update: {},
    create: {
      name: 'Hess Solutions',
      slug: 'hess-solutions',
      themeConfig: {
        primaryColor: '#d4a017',
        primaryDark: '#b8860b',
        background: '#1a1a1a',
        surface: '#2a2a2a',
        text: '#ffffff',
      },
      settings: {
        authMode: 'PASSWORD',
      },
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const superAdminHash = await argon2.hash('DevSuperAdmin1!', {
    type: argon2.argon2id,
  });
  const adminHash = await argon2.hash('DevAdmin1!', { type: argon2.argon2id });
  const operatorHash = await argon2.hash('DevOperator1!', {
    type: argon2.argon2id,
  });
  const pinHash = await argon2.hash('1234', { type: argon2.argon2id });

  const superAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'superadmin@hess.dev' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Andrew Hess',
      email: 'superadmin@hess.dev',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      active: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@hess.dev' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Shop Admin',
      email: 'admin@hess.dev',
      passwordHash: adminHash,
      role: 'ADMIN',
      active: true,
    },
  });

  const op1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'op1@hess.dev' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'John Smith',
      email: 'op1@hess.dev',
      passwordHash: operatorHash,
      pinHash,
      role: 'OPERATOR',
      active: true,
    },
  });

  const op2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'op2@hess.dev' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Jane Doe',
      email: 'op2@hess.dev',
      passwordHash: operatorHash,
      pinHash,
      role: 'OPERATOR',
      active: true,
    },
  });

  console.log(
    `✅ Users: ${superAdmin.name}, ${admin.name}, ${op1.name}, ${op2.name}`,
  );

  // ── Customers ─────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'seed-cust-1' },
      update: {},
      create: {
        id: 'seed-cust-1',
        tenantId: tenant.id,
        businessName: 'Acme Manufacturing',
        email: 'orders@acme.dev',
        phone: '555-0101',
        billingMethod: 'Net 30',
      },
    }),
    prisma.customer.upsert({
      where: { id: 'seed-cust-2' },
      update: {},
      create: {
        id: 'seed-cust-2',
        tenantId: tenant.id,
        businessName: 'Precision Parts Co.',
        email: 'purchasing@precision.dev',
        phone: '555-0102',
        billingMethod: 'Net 15',
      },
    }),
    prisma.customer.upsert({
      where: { id: 'seed-cust-3' },
      update: {},
      create: {
        id: 'seed-cust-3',
        tenantId: tenant.id,
        businessName: 'Delta Industries',
        email: 'contact@delta.dev',
        phone: '555-0103',
        billingMethod: 'COD',
      },
    }),
  ]);
  console.log(
    `✅ Customers: ${customers.map((c) => c.businessName).join(', ')}`,
  );

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobs = await Promise.all([
    prisma.job.upsert({
      where: {
        tenantId_jobNumber: { tenantId: tenant.id, jobNumber: 'J-0001' },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        jobNumber: 'J-0001',
        customerId: customers[0].id,
        partName: 'Shaft Coupler',
        partNumber: 'SC-100',
        quantity: 10,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        department: 'ON_MACHINE',
        priority: 'HIGH',
        progressPct: 60,
      },
    }),
    prisma.job.upsert({
      where: {
        tenantId_jobNumber: { tenantId: tenant.id, jobNumber: 'J-0002' },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        jobNumber: 'J-0002',
        customerId: customers[1].id,
        partName: 'Bearing Housing',
        partNumber: 'BH-220',
        quantity: 4,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        department: 'ON_DECK',
        priority: 'NORMAL',
        progressPct: 20,
      },
    }),
    prisma.job.upsert({
      where: {
        tenantId_jobNumber: { tenantId: tenant.id, jobNumber: 'J-0003' },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        jobNumber: 'J-0003',
        customerId: customers[2].id,
        partName: 'Valve Body',
        partNumber: 'VB-305',
        quantity: 2,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // overdue
        department: 'FINISHING',
        priority: 'HIGH',
        progressPct: 80,
      },
    }),
    prisma.job.upsert({
      where: {
        tenantId_jobNumber: { tenantId: tenant.id, jobNumber: 'J-0004' },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        jobNumber: 'J-0004',
        customerId: customers[0].id,
        partName: 'Flange Adapter',
        partNumber: 'FA-410',
        quantity: 25,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        department: 'QUOTING',
        priority: 'LOW',
        progressPct: 5,
      },
    }),
    prisma.job.upsert({
      where: {
        tenantId_jobNumber: { tenantId: tenant.id, jobNumber: 'J-0005' },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        jobNumber: 'J-0005',
        customerId: customers[1].id,
        partName: 'End Cap',
        partNumber: 'EC-505',
        quantity: 50,
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // shipped
        department: 'SHIPPED',
        priority: 'NORMAL',
        progressPct: 100,
      },
    }),
  ]);
  console.log(`✅ Jobs: ${jobs.map((j) => j.jobNumber).join(', ')}`);

  console.log('\n🎉 Seed complete!');
  console.log('\nDev login credentials:');
  console.log('  Super Admin: superadmin@hess.dev / DevSuperAdmin1!');
  console.log('  Admin:       admin@hess.dev       / DevAdmin1!');
  console.log(
    '  Operator:    op1@hess.dev         / DevOperator1! or PIN: 1234',
  );
  console.log(`\n  Tenant ID: ${tenant.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
