'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getInvoiceDetail, Invoice, Team, Client, formatCurrency, formatDate, getStatusColor } from '@/lib/api';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getInvoiceDetail(params.id as string);
        setInvoice(data.invoice);
        setTeam(data.team);
        setClient(data.client);
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center shadow-sm border border-gray-200 dark:border-slate-700">
        <svg className="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Invoice not found</h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">{error}</p>
        <Link href="/dashboard/invoices" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <Link href="/dashboard/invoices" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
            ← Back to invoices
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice #{invoice.invoice_number}</h1>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Content */}
      <div ref={printRef} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden print:shadow-none print:border-none">
        <div className="p-8 print:p-0">
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row justify-between mb-8 pb-8 border-b border-gray-200 dark:border-slate-700 print:border-gray-300">
            <div>
              {team && (
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-black">{team.billing_name || team.name}</h2>
                  {team.billing_address && <p className="text-gray-600 dark:text-gray-400 print:text-gray-700">{team.billing_address}</p>}
                  {(team.billing_city || team.billing_province || team.billing_postal_code) && (
                    <p className="text-gray-600 dark:text-gray-400 print:text-gray-700">
                      {[team.billing_city, team.billing_province, team.billing_postal_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {team.billing_phone && <p className="text-gray-600 dark:text-gray-400 print:text-gray-700">{team.billing_phone}</p>}
                </>
              )}
            </div>
            <div className="mt-4 sm:mt-0 sm:text-right">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white print:text-black">INVOICE</h3>
              <p className="text-gray-600 dark:text-gray-400 print:text-gray-700 mt-1">#{invoice.invoice_number}</p>
              <div className="mt-2">
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(invoice.status)} print:bg-gray-200 print:text-gray-800`}>
                  {invoice.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600 uppercase mb-2">Bill To</h4>
              {client && (
                <div className="text-gray-900 dark:text-white print:text-black">
                  <p className="font-medium">{client.name}</p>
                  {client.email && <p className="text-gray-600 dark:text-gray-400 print:text-gray-700">{client.email}</p>}
                </div>
              )}
            </div>
            <div className="sm:text-right">
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">Issue Date: </span>
                <span className="text-gray-900 dark:text-white print:text-black">{formatDate(invoice.issue_date)}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">Due Date: </span>
                <span className="text-gray-900 dark:text-white print:text-black font-medium">{formatDate(invoice.due_date)}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-8 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700 print:border-gray-300">
                  <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600 uppercase">Description</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600 uppercase">Qty/Hrs</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600 uppercase">Rate</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_line_items?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-slate-700/50 print:border-gray-200">
                    <td className="py-4 text-gray-900 dark:text-white print:text-black">{item.item_name}</td>
                    <td className="py-4 text-right text-gray-600 dark:text-gray-400 print:text-gray-700">{item.hours}</td>
                    <td className="py-4 text-right text-gray-600 dark:text-gray-400 print:text-gray-700">{formatCurrency(item.rate)}</td>
                    <td className="py-4 text-right text-gray-900 dark:text-white print:text-black font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72">
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400 print:text-gray-700">Subtotal</span>
                <span className="text-gray-900 dark:text-white print:text-black">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tps_amount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400 print:text-gray-700">TPS (5%)</span>
                  <span className="text-gray-900 dark:text-white print:text-black">{formatCurrency(invoice.tps_amount)}</span>
                </div>
              )}
              {invoice.tvq_amount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 dark:text-gray-400 print:text-gray-700">TVQ (9.975%)</span>
                  <span className="text-gray-900 dark:text-white print:text-black">{formatCurrency(invoice.tvq_amount)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-gray-200 dark:border-slate-700 print:border-gray-300 mt-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white print:text-black">Total</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white print:text-black">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Tax Numbers */}
          {team && (team.tps_number || team.tvq_number) && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 print:border-gray-300 text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">
              {team.tps_number && <p>TPS #: {team.tps_number}</p>}
              {team.tvq_number && <p>TVQ #: {team.tvq_number}</p>}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 print:border-gray-300">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600 uppercase mb-2">Notes</h4>
              <p className="text-gray-700 dark:text-gray-300 print:text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #__next {
            visibility: visible;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
