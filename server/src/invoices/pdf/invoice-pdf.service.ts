import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import ReactPDF, {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { createElement } from 'react';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '2pt solid #d4a017',
    paddingBottom: 12,
  },
  companyName: { fontSize: 20, fontWeight: 'bold', color: '#d4a017' },
  subtitle: { fontSize: 9, color: '#666', marginTop: 2 },
  invoiceTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  invoiceMeta: { fontSize: 9, color: '#888', textAlign: 'right', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  // Line items table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '1pt solid #ddd',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottom: '0.5pt solid #eee',
  },
  col_desc: { flex: 3 },
  col_qty: { flex: 1, textAlign: 'right' },
  col_price: { flex: 1, textAlign: 'right' },
  col_total: { flex: 1, textAlign: 'right' },
  tableHeaderText: { fontWeight: 'bold', fontSize: 9, color: '#555' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '0.5pt solid #e5e5e5',
  },
  totalsLabel: { color: '#555' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTop: '2pt solid #d4a017',
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 12, fontWeight: 'bold' },
  grandTotalValue: { fontSize: 14, fontWeight: 'bold', color: '#d4a017' },
  statusBadge: {
    padding: '4 10',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#aaa',
    textAlign: 'center',
    borderTop: '0.5pt solid #e5e5e5',
    paddingTop: 8,
  },
});

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  customer: {
    businessName: string;
    email: string | null;
    phone: string | null;
  };
  job: { jobNumber: string; partName: string } | null;
  lineItems: LineItem[];
  subtotal: string;
  tax: string;
  total: string;
  status: string;
  dueDate: Date | string | null;
  createdAt: Date | string;
  orgName: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  SENT: '#2563eb',
  PAID: '#16a34a',
  OVERDUE: '#dc2626',
};
const STATUS_BG: Record<string, string> = {
  DRAFT: '#f3f4f6',
  SENT: '#eff6ff',
  PAID: '#f0fdf4',
  OVERDUE: '#fef2f2',
};

function InvoiceDocument(inv: InvoiceData) {
  const createdDate = new Date(inv.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dueDate = inv.dueDate
    ? new Date(inv.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'LETTER', style: styles.page },

      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(
          View,
          null,
          createElement(Text, { style: styles.companyName }, inv.orgName),
          createElement(Text, { style: styles.subtitle }, 'Shop ERP — Invoice'),
        ),
        createElement(
          View,
          null,
          createElement(Text, { style: styles.invoiceTitle }, 'INVOICE'),
          createElement(Text, { style: styles.invoiceMeta }, inv.invoiceNumber),
          createElement(
            Text,
            { style: styles.invoiceMeta },
            `Date: ${createdDate}`,
          ),
          dueDate
            ? createElement(
                Text,
                { style: styles.invoiceMeta },
                `Due: ${dueDate}`,
              )
            : null,
        ),
      ),

      // Status
      createElement(
        View,
        { style: styles.section },
        createElement(
          Text,
          {
            style: {
              ...styles.statusBadge,
              backgroundColor: STATUS_BG[inv.status] ?? '#f3f4f6',
              color: STATUS_COLORS[inv.status] ?? '#6b7280',
            },
          },
          inv.status,
        ),
      ),

      // Bill to
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
        createElement(Text, null, inv.customer.businessName),
        inv.customer.email
          ? createElement(
              Text,
              { style: { color: '#555', marginTop: 2 } },
              inv.customer.email,
            )
          : null,
        inv.customer.phone
          ? createElement(
              Text,
              { style: { color: '#555', marginTop: 2 } },
              inv.customer.phone,
            )
          : null,
      ),

      // Job reference
      inv.job
        ? createElement(
            View,
            { style: styles.section },
            createElement(
              Text,
              { style: styles.sectionTitle },
              'Job Reference',
            ),
            createElement(
              Text,
              null,
              `${inv.job.jobNumber} — ${inv.job.partName}`,
            ),
          )
        : null,

      // Line items
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Line Items'),
        // Table header
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(
            Text,
            { style: { ...styles.col_desc, ...styles.tableHeaderText } },
            'Description',
          ),
          createElement(
            Text,
            { style: { ...styles.col_qty, ...styles.tableHeaderText } },
            'Qty',
          ),
          createElement(
            Text,
            { style: { ...styles.col_price, ...styles.tableHeaderText } },
            'Unit Price',
          ),
          createElement(
            Text,
            { style: { ...styles.col_total, ...styles.tableHeaderText } },
            'Total',
          ),
        ),
        // Rows
        ...inv.lineItems.map((item, i) =>
          createElement(
            View,
            { key: String(i), style: styles.tableRow },
            createElement(Text, { style: styles.col_desc }, item.description),
            createElement(
              Text,
              { style: styles.col_qty },
              String(item.quantity),
            ),
            createElement(
              Text,
              { style: styles.col_price },
              `$${item.unitPrice.toFixed(2)}`,
            ),
            createElement(
              Text,
              { style: styles.col_total },
              `$${(item.quantity * item.unitPrice).toFixed(2)}`,
            ),
          ),
        ),
      ),

      // Totals
      createElement(
        View,
        { style: { ...styles.section, paddingLeft: '50%' } },
        createElement(
          View,
          { style: styles.totalsRow },
          createElement(Text, { style: styles.totalsLabel }, 'Subtotal'),
          createElement(Text, null, `$${Number(inv.subtotal).toFixed(2)}`),
        ),
        createElement(
          View,
          { style: styles.totalsRow },
          createElement(Text, { style: styles.totalsLabel }, 'Tax'),
          createElement(Text, null, `$${Number(inv.tax).toFixed(2)}`),
        ),
        createElement(
          View,
          { style: styles.grandTotalRow },
          createElement(Text, { style: styles.grandTotalLabel }, 'Total'),
          createElement(
            Text,
            { style: styles.grandTotalValue },
            `$${Number(inv.total).toFixed(2)}`,
          ),
        ),
      ),

      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `${inv.orgName} · ${inv.invoiceNumber}`,
      ),
    ),
  );
}

@Injectable()
export class InvoicePdfService {
  async generate(invoice: InvoiceData, outputDir: string): Promise<string> {
    const fileName = `invoice-${invoice.id}.pdf`;
    const outputPath = path.join(outputDir, fileName);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    await ReactPDF.renderToFile(
      InvoiceDocument(invoice) as unknown as React.ReactElement,
      outputPath,
    );
    return outputPath;
  }
}
