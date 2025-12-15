'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getInvoices, Invoice, InvoiceSummary, formatCurrency, formatDate, getStatusColor } from '@/lib/api';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getInvoices();
        setInvoices(data.invoices);
        setSummary(data.summary);
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === 'all') return true;
    if (filter === 'unpaid') return inv.status === 'unpaid' || inv.status === 'overdue';
    if (filter === 'paid') return inv.status === 'paid';
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Invoices</h1>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(summary.total_outstanding)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{summary.outstanding_count} invoice(s)</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.total_paid)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{summary.paid_count} invoice(s)</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(summary.total_paid + summary.total_outstanding)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{invoices.length} invoice(s)</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-6">
        {(['all', 'unpaid', 'paid'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center shadow-sm border border-gray-200 dark:border-slate-700">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No invoices</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'No invoices have been shared with you yet.' : `No ${filter} invoices.`}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900 dark:text-white">#{invoice.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(invoice.issue_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
