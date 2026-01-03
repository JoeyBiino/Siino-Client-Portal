'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getInvoices, formatCurrency, formatDate, Invoice, InvoiceSummary } from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

export default function InvoicesPage() {
  const { lang } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await getInvoices();
      setInvoices(data.invoices);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (filter === 'all') return true;
    return invoice.status === filter;
  });

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-500/20 text-green-400';
      case 'unpaid':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'overdue':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#9B7EBF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{lang === 'fr' ? 'Factures' : 'Invoices'}</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-4">
            <p className="text-sm text-gray-400">{lang === 'fr' ? 'Total payé' : 'Total Paid'}</p>
            <p className="text-xl font-bold text-green-400 mt-1">{formatCurrency(summary.total_paid)}</p>
          </div>
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-4">
            <p className="text-sm text-gray-400">{lang === 'fr' ? 'En attente' : 'Outstanding'}</p>
            <p className="text-xl font-bold text-yellow-400 mt-1">{formatCurrency(summary.total_outstanding)}</p>
          </div>
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-4">
            <p className="text-sm text-gray-400">{lang === 'fr' ? 'Factures payées' : 'Paid Invoices'}</p>
            <p className="text-xl font-bold text-white mt-1">{summary.paid_count}</p>
          </div>
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-4">
            <p className="text-sm text-gray-400">{lang === 'fr' ? 'Factures impayées' : 'Unpaid Invoices'}</p>
            <p className="text-xl font-bold text-white mt-1">{summary.outstanding_count}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-[#9B7EBF] text-white'
                : 'bg-[#1a1a1e] text-gray-400 hover:bg-[#2a2a32] hover:text-white border border-[#2a2a32]'
            }`}
          >
            {f === 'all' 
              ? (lang === 'fr' ? 'Toutes' : 'All')
              : f === 'unpaid'
                ? (lang === 'fr' ? 'Impayées' : 'Unpaid')
                : (lang === 'fr' ? 'Payées' : 'Paid')
            }
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-8 text-center">
          <div className="w-12 h-12 bg-[#2a2a32] rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500">{lang === 'fr' ? 'Aucune facture trouvée' : 'No invoices found'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map(invoice => (
            <Link
              key={invoice.id}
              href={`/dashboard/invoices/${invoice.id}`}
              className="block bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-4 hover:border-[#9B7EBF]/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-white">#{invoice.invoice_number}</h3>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusStyle(invoice.status)}`}>
                      {invoice.status === 'paid' 
                        ? (lang === 'fr' ? 'Payée' : 'Paid')
                        : invoice.status === 'unpaid'
                          ? (lang === 'fr' ? 'Impayée' : 'Unpaid')
                          : invoice.status
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{lang === 'fr' ? 'Émise le' : 'Issued'} {formatDate(invoice.issue_date)}</span>
                    <span>{lang === 'fr' ? 'Due le' : 'Due'} {formatDate(invoice.due_date)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-white">{formatCurrency(invoice.total_amount)}</p>
                  <p className="text-sm text-gray-500">{invoice.invoice_line_items?.length || 0} {lang === 'fr' ? 'articles' : 'items'}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
