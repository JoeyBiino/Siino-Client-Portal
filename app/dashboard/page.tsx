'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProjects, getInvoices, Project, Invoice, InvoiceSummary, formatCurrency, formatDate, getStatusColor } from '@/lib/api';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectsData, invoicesData] = await Promise.all([
          getProjects(),
          getInvoices(),
        ]);
        setProjects(projectsData.projects);
        setInvoices(invoicesData.invoices);
        setSummary(invoicesData.summary);
      } catch (error) {
        console.error('Failed to fetch data:', error);
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

  const recentProjects = projects.slice(0, 3);
  const recentInvoices = invoices.slice(0, 3);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Projects</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{projects.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Invoices</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{invoices.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{formatCurrency(summary?.total_outstanding || 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(summary?.total_paid || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Projects */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Projects</h2>
            <Link href="/dashboard/projects" className="text-sm text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {recentProjects.length === 0 ? (
              <p className="p-6 text-gray-500 dark:text-gray-400 text-center">No projects yet</p>
            ) : (
              recentProjects.map((project) => (
                <div key={project.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{project.name}</h3>
                      {project.deadline && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Due: {formatDate(project.deadline)}
                        </p>
                      )}
                    </div>
                    {project.status && (
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: `${project.status.color}20`,
                          color: project.status.color,
                        }}
                      >
                        {project.status.name}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Invoices</h2>
            <Link href="/dashboard/invoices" className="text-sm text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {recentInvoices.length === 0 ? (
              <p className="p-6 text-gray-500 dark:text-gray-400 text-center">No invoices yet</p>
            ) : (
              recentInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="block p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Invoice #{invoice.invoice_number}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(invoice.issue_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(invoice.total_amount)}</p>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
