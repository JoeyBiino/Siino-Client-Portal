'use client';

import { useEffect, useState } from 'react';
import { getProjects, formatDate, Project } from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

export default function ProjectsPage() {
  const { t, lang } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data.projects);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      <h1 className="text-2xl font-bold text-white mb-6">{t('projects')}</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-8 text-center">
          <div className="w-12 h-12 bg-[#2a2a32] rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500">{lang === 'fr' ? 'Aucun projet disponible' : 'No projects available'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <div key={project.id} className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold text-white">{project.name}</h2>
                    {project.status && (
                      <span 
                        className="px-2.5 py-1 text-xs font-medium rounded-full"
                        style={{ 
                          backgroundColor: `${project.status.color}20`,
                          color: project.status.color 
                        }}
                      >
                        {project.status.name}
                      </span>
                    )}
                    {project.project_type && (
                      <span 
                        className="px-2.5 py-1 text-xs font-medium rounded-full"
                        style={{ 
                          backgroundColor: `${project.project_type.color}20`,
                          color: project.project_type.color 
                        }}
                      >
                        {project.project_type.name}
                      </span>
                    )}
                  </div>
                  
                  {project.notes && (
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{project.notes}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {project.deadline && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {lang === 'fr' ? 'Échéance:' : 'Due:'} {formatDate(project.deadline)}
                      </div>
                    )}
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {lang === 'fr' ? 'Mis à jour:' : 'Updated:'} {formatDate(project.updated_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
