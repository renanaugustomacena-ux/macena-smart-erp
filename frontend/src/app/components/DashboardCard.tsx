'use client';

import Link from 'next/link';

interface ModuleInfo {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  stats: { label: string; value: string }[];
}

interface DashboardCardProps {
  module: ModuleInfo;
}

export default function DashboardCard({ module }: DashboardCardProps) {
  return (
    <Link href={module.href} className="group relative block">
      <div className="card card-hover relative overflow-hidden">
        {/* Gradient accent line at top */}
        <div
          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${module.color}`}
        />

        {/* Background hover effect */}
        <div className="module-card-gradient" />

        {/* Content */}
        <div className="relative">
          {/* Icon and title */}
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${module.color} shadow-sm`}
            >
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={module.icon}
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600">
                {module.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                {module.description}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 flex gap-6 border-t border-gray-100 pt-4">
            {module.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Arrow indicator */}
          <div className="absolute right-0 top-0 text-gray-300 transition-colors group-hover:text-indigo-500">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
