'use client';

import { useEffect, useState } from 'react';
import { getProjects, Project, formatDate } from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getProjects();
        setProjects(data.projects);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Projects</h1>

      {projects.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center shadow-sm border border-gray-200 dark:border-slate-700">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No projects</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">No projects have been shared with you yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition"
            >
              {/* Project Type Banner */}
              {project.project_type && (
                <div
                  className="h-2"
                  style={{ backgroundColor: project.project_type.color }}
                />
              )}
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{project.name}</h3>
                  {project.status && (
                    <span
                      className="px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ml-2"
                      style={{
                        backgroundColor: `${project.status.color}20`,
                        color: project.status.color,
                      }}
                    >
                      {project.status.name}
                    </span>
                  )}
                </div>

                {project.project_type && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {project.project_type.name}
                  </p>
                )}

                {project.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                    {project.notes}
                  </p>
                )}

                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {project.deadline ? (
                    <span>Due: {formatDate(project.deadline)}</span>
                  ) : (
                    <span>No deadline set</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
