import React from 'react';
import { ChevronDown, ChevronRight, MessageSquareText } from 'lucide-react';
import type { PEOEmployerComment } from './types';

interface PEOEmployerCommentsProps {
  comments: PEOEmployerComment[];
}

const formatSubmittedAt = (value: string | null) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const groupComments = (comments: PEOEmployerComment[]) => {
  const grouped = new Map<string, { title: string; comments: PEOEmployerComment[] }>();

  comments.forEach((comment) => {
    const key = comment.peoId || 'ungrouped';
    const title = comment.peoCode
      ? `${comment.peoCode}${comment.peoTitle ? ` - ${comment.peoTitle}` : ''}`
      : 'Additional Employer Comments';
    const group = grouped.get(key) || { title, comments: [] };
    group.comments.push(comment);
    grouped.set(key, group);
  });

  return Array.from(grouped.entries()).map(([key, value]) => ({ key, ...value }));
};

const PEOEmployerComments: React.FC<PEOEmployerCommentsProps> = ({ comments }) => {
  const groups = React.useMemo(() => groupComments(comments), [comments]);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setExpandedGroups({});
  }, [comments]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Employer Comments</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Qualitative Employer Feedback</h2>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
          {comments.length.toLocaleString()} comment{comments.length === 1 ? '' : 's'}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500">
          No employer text feedback has been submitted for this report cycle yet.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = !!expandedGroups[group.key];

            return (
              <div key={group.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MessageSquareText className="h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{group.title}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {group.comments.length} comment{group.comments.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {group.comments.map((comment) => (
                      <article key={comment.id} className="px-4 py-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                            {comment.employerIdentifier || 'Employer not identified'}
                          </span>
                          {comment.employerOrganization && (
                            <span>{comment.employerOrganization}</span>
                          )}
                          {comment.employeeName && (
                            <span>Employee: {comment.employeeName}</span>
                          )}
                          <span>{formatSubmittedAt(comment.submittedAt)}</span>
                        </div>
                        {comment.peoId && comment.questionText && (
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                            {comment.questionText}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{comment.comment}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PEOEmployerComments;
