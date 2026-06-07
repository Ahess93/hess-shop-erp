import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import ReactPDF, {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { createElement } from 'react';

// Register a basic font (uses built-in Helvetica from PDF spec)
Font.register({
  family: 'Helvetica',
  src: 'Helvetica',
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '2pt solid #d4a017',
    paddingBottom: 12,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d4a017',
  },
  companySubtitle: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#1a1a1a',
  },
  quoteNumber: {
    fontSize: 9,
    color: '#888',
    textAlign: 'right',
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '0.5pt solid #e5e5e5',
  },
  label: { color: '#555', flex: 1 },
  value: { fontWeight: 'bold', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTop: '2pt solid #d4a017',
    marginTop: 4,
  },
  totalLabel: { fontSize: 12, fontWeight: 'bold' },
  totalValue: { fontSize: 14, fontWeight: 'bold', color: '#d4a017' },
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

interface QuoteData {
  id: string;
  customer: { businessName: string; email: string | null };
  job: { jobNumber: string; partName: string; quantity: number } | null;
  laborRate: string;
  estRunTime: string;
  materialCost: string;
  markupPct: string;
  calculatedPrice: string;
  status: string;
  createdAt: Date | string;
  orgName: string;
}

function QuoteDocument(quote: QuoteData) {
  const statusColors: Record<string, string> = {
    DRAFT: '#6b7280',
    SENT: '#2563eb',
    ACCEPTED: '#16a34a',
    REJECTED: '#dc2626',
  };

  const statusBg: Record<string, string> = {
    DRAFT: '#f3f4f6',
    SENT: '#eff6ff',
    ACCEPTED: '#f0fdf4',
    REJECTED: '#fef2f2',
  };

  const formattedDate = new Date(quote.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalHours = (
    Number(quote.laborRate) * Number(quote.estRunTime)
  ).toFixed(2);

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
          createElement(Text, { style: styles.companyName }, quote.orgName),
          createElement(
            Text,
            { style: styles.companySubtitle },
            'Shop ERP — Quote',
          ),
        ),
        createElement(
          View,
          null,
          createElement(Text, { style: styles.quoteTitle }, 'QUOTE'),
          createElement(
            Text,
            { style: styles.quoteNumber },
            `#${quote.id.slice(-8).toUpperCase()}`,
          ),
          createElement(Text, { style: styles.quoteNumber }, formattedDate),
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
              backgroundColor: statusBg[quote.status] ?? '#f3f4f6',
              color: statusColors[quote.status] ?? '#6b7280',
            },
          },
          quote.status,
        ),
      ),

      // Customer
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
        createElement(Text, null, quote.customer.businessName),
        quote.customer.email
          ? createElement(
              Text,
              { style: { color: '#555', marginTop: 2 } },
              quote.customer.email,
            )
          : null,
      ),

      // Job reference
      quote.job
        ? createElement(
            View,
            { style: styles.section },
            createElement(
              Text,
              { style: styles.sectionTitle },
              'Job Reference',
            ),
            createElement(
              View,
              { style: styles.row },
              createElement(Text, { style: styles.label }, 'Job Number'),
              createElement(Text, { style: styles.value }, quote.job.jobNumber),
            ),
            createElement(
              View,
              { style: styles.row },
              createElement(Text, { style: styles.label }, 'Part Name'),
              createElement(Text, { style: styles.value }, quote.job.partName),
            ),
            createElement(
              View,
              { style: styles.row },
              createElement(Text, { style: styles.label }, 'Quantity'),
              createElement(
                Text,
                { style: styles.value },
                String(quote.job.quantity),
              ),
            ),
          )
        : null,

      // Pricing breakdown
      createElement(
        View,
        { style: styles.section },
        createElement(
          Text,
          { style: styles.sectionTitle },
          'Pricing Breakdown',
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Labor Rate'),
          createElement(
            Text,
            { style: styles.value },
            `$${Number(quote.laborRate).toFixed(2)}/hr`,
          ),
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Estimated Run Time'),
          createElement(
            Text,
            { style: styles.value },
            `${Number(quote.estRunTime).toFixed(2)} hrs`,
          ),
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Labor Cost'),
          createElement(Text, { style: styles.value }, `$${totalHours}`),
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Material Cost'),
          createElement(
            Text,
            { style: styles.value },
            `$${Number(quote.materialCost).toFixed(2)}`,
          ),
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, 'Markup'),
          createElement(
            Text,
            { style: styles.value },
            `${Number(quote.markupPct).toFixed(1)}%`,
          ),
        ),
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.totalLabel }, 'Total Price'),
          createElement(
            Text,
            { style: styles.totalValue },
            `$${Number(quote.calculatedPrice).toFixed(2)}`,
          ),
        ),
      ),

      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `Generated by ${quote.orgName} Shop ERP · Quote #${quote.id.slice(-8).toUpperCase()}`,
      ),
    ),
  );
}

@Injectable()
export class QuotePdfService {
  async generate(quote: QuoteData, outputDir: string): Promise<string> {
    const fileName = `quote-${quote.id}.pdf`;
    const outputPath = path.join(outputDir, fileName);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    await ReactPDF.renderToFile(
      QuoteDocument(quote) as unknown as React.ReactElement,
      outputPath,
    );

    return outputPath;
  }
}
