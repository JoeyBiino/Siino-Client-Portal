'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProjects, getInvoices, getMyBookings, formatCurrency, formatDate, Project, Invoice, Booking } from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, invoicesData, bookingsData] = await Promise.all([
        getProjects().catch(() => ({ projects: [] })),
        getInvoices().catch(() => ({ invoices: [], summary: { total_paid: 0, total_outstanding: 0, paid_count: 0, outstanding_count: 0 } })),
        getMyBookings().catch(() => ({ bookings: [] }))
      ]);
      setProjects(projectsData.projects || []);
      setInvoices(invoicesData.invoices || []);
      setBookings(bookingsData.bookings || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const recentProjects = projects.slice(0, 3);
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid').slice(0, 3);
  const upcomingBookings = bookings
    .filter(b => new Date(b.start_time) >= new Date() && ['pending', 'confirmed'].includes(b.status))
    .slice(0, 3);

  const totalOutstanding = invoices
    .filter(i => i.status === 'unpaid')
    .reduce((sum, i) => sum + i.total_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#9B7EBF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('dashboard')}</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">{lang === 'fr' ? 'Projets actifs' : 'Active Projects'}</p>
              <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
            </div>
            <div className="w-12 h-12 bg-[#9B7EBF]/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-[#9B7EBF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">{lang === 'fr' ? 'Montant dû' : 'Outstanding'}</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalOutstanding)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">{lang === 'fr' ? 'Réservations à venir' : 'Upcoming Bookings'}</p>
              <p className="text-2xl font-bold text-white mt-1">{upcomingBookings.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{lang === 'fr' ? 'Projets récents' : 'Recent Projects'}</h2>
            <Link href="/dashboard/projects" className="text-sm text-[#9B7EBF] hover:text-[#b599d0] transition-colors">
              {lang === 'fr' ? 'Voir tout' : 'View all'}
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">{lang === 'fr' ? 'Aucun projet' : 'No projects yet'}</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map(project => (
                <div key={project.id} className="p-3 bg-[#16161a] rounded-lg border border-[#1e1e24]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">{project.name}</h3>
                    {project.status && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-[#9B7EBF]/20 text-[#9B7EBF]">
                        {project.status.name}
                      </span>
                    )}
                  </div>
                  {project.deadline && (
                    <p className="text-sm text-gray-500 mt-1">
                      {lang === 'fr' ? 'Échéance:' : 'Due:'} {formatDate(project.deadline)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unpaid Invoices */}
        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{lang === 'fr' ? 'Factures impayées' : 'Unpaid Invoices'}</h2>
            <Link href="/dashboard/invoices" className="text-sm text-[#9B7EBF] hover:text-[#b599d0] transition-colors">
              {lang === 'fr' ? 'Voir tout' : 'View all'}
            </Link>
          </div>
          {unpaidInvoices.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">{lang === 'fr' ? 'Aucune facture impayée' : 'No unpaid invoices'}</p>
          ) : (
            <div className="space-y-3">
              {unpaidInvoices.map(invoice => (
                <Link key={invoice.id} href={`/dashboard/invoices/${invoice.id}`}
                  className="block p-3 bg-[#16161a] rounded-lg border border-[#1e1e24] hover:border-[#9B7EBF]/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">#{invoice.invoice_number}</h3>
                      <p className="text-sm text-gray-500">{lang === 'fr' ? 'Dû le' : 'Due'} {formatDate(invoice.due_date)}</p>
                    </div>
                    <span className="font-semibold text-white">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t('upcoming')}</h2>
            <Link href="/dashboard/bookings" className="text-sm text-[#9B7EBF] hover:text-[#b599d0] transition-colors">
              {lang === 'fr' ? 'Voir tout' : 'View all'}
            </Link>
          </div>
          {upcomingBookings.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">{t('noUpcomingBookings')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingBookings.map(booking => (
                <div key={booking.id} className="p-3 bg-[#16161a] rounded-lg border border-[#1e1e24]">
                  <h3 className="font-medium text-white">{booking.service?.name || booking.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(booking.start_time)}
                  </p>
                  <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
                    booking.status === 'confirmed' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {t(booking.status as any)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
