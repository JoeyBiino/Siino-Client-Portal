'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getInvoiceDetail, formatCurrency, formatDate, Invoice, Team } from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

export default function InvoiceDetailPage() {
  const { lang } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id as string);
    }
  }, [params.id]);

  const loadInvoice = async (id: string) => {
    try {
      setLoading(true);
      const data = await getInvoiceDetail(id);
      setInvoice(data.invoice);
      setTeam(data.team);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error || (lang === 'fr' ? 'Facture non trouvée' : 'Invoice not found')}</p>
        <Link href="/dashboard/invoices" className="text-[#9B7EBF] hover:text-[#b599d0]">
          {lang === 'fr' ? '← Retour aux factures' : '← Back to invoices'}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/invoices" className="inline-flex items-center text-[#9B7EBF] hover:text-[#b599d0] mb-6 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {lang === 'fr' ? 'Retour aux factures' : 'Back to invoices'}
      </Link>

      <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#2a2a32]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{lang === 'fr' ? 'Facture' : 'Invoice'} #{invoice.invoice_number}</h1>
              <p className="text-gray-500 mt-1">{lang === 'fr' ? 'Émise le' : 'Issued'} {formatDate(invoice.issue_date)}</p>
            </div>
            <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${getStatusStyle(invoice.status)}`}>
              {invoice.status === 'paid' 
                ? (lang === 'fr' ? 'Payée' : 'Paid')
                : invoice.status === 'unpaid'
                  ? (lang === 'fr' ? 'Impayée' : 'Unpaid')
                  : invoice.status
              }
            </span>
          </div>

          {team && (
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">{lang === 'fr' ? 'De' : 'From'}</h3>
                <p className="text-white font-medium">{team.billing_name || team.name}</p>
                {team.billing_address && <p className="text-gray-400 text-sm">{team.billing_address}</p>}
                {team.billing_city && (
                  <p className="text-gray-400 text-sm">
                    {team.billing_city}, {team.billing_province} {team.billing_postal_code}
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">{lang === 'fr' ? 'Échéance' : 'Due Date'}</h3>
                <p className="text-white font-medium">{formatDate(invoice.due_date)}</p>
                {invoice.paid_at && (
                  <p className="text-green-400 text-sm mt-1">
                    {lang === 'fr' ? 'Payée le' : 'Paid on'} {formatDate(invoice.paid_at)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">{lang === 'fr' ? 'Articles' : 'Line Items'}</h3>
          <div className="space-y-3">
            {invoice.invoice_line_items?.map((item, index) => (
              <div key={item.id || index} className="flex items-center justify-between p-3 bg-[#16161a] rounded-lg border border-[#1e1e24]">
                <div className="flex-1">
                  <p className="text-white font-medium">{item.item_name}</p>
                  <p className="text-sm text-gray-500">
                    {item.is_quantity_based 
                      ? `${item.hours} x ${formatCurrency(item.rate)}`
                      : `${item.hours} ${lang === 'fr' ? 'heures' : 'hours'} × ${formatCurrency(item.rate)}/hr`
                    }
                  </p>
                </div>
                <p className="text-white font-medium">{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 pt-6 border-t border-[#2a2a32] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{lang === 'fr' ? 'Sous-total' : 'Subtotal'}</span>
              <span className="text-white">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tps_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">TPS/GST (5%)</span>
                <span className="text-white">{formatCurrency(invoice.tps_amount)}</span>
              </div>
            )}
            {invoice.tvq_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">TVQ/QST (9.975%)</span>
                <span className="text-white">{formatCurrency(invoice.tvq_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold pt-3 border-t border-[#2a2a32]">
              <span className="text-white">{lang === 'fr' ? 'Total' : 'Total'}</span>
              <span className="text-[#9B7EBF]">{formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>

          {/* Tax Numbers */}
          {team && (team.tps_number || team.tvq_number) && (
            <div className="mt-6 pt-6 border-t border-[#2a2a32]">
              <h3 className="text-sm font-medium text-gray-400 mb-2">{lang === 'fr' ? 'Numéros de taxe' : 'Tax Numbers'}</h3>
              <div className="text-sm text-gray-500 space-y-1">
                {team.tps_number && <p>TPS/GST: {team.tps_number}</p>}
                {team.tvq_number && <p>TVQ/QST: {team.tvq_number}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-6 pt-6 border-t border-[#2a2a32]">
              <h3 className="text-sm font-medium text-gray-400 mb-2">{lang === 'fr' ? 'Notes' : 'Notes'}</h3>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
