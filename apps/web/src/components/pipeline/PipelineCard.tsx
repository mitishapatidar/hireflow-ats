'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PipelineCardDTO } from '@hireflow/shared';
import { GripVertical, XCircle, Clock, Briefcase, IndianRupee } from 'lucide-react';

interface PipelineCardProps {
  card: PipelineCardDTO;
  isDragging?: boolean;
  onCardClick: (applicationId: string) => void;
  onRejectClick: (applicationId: string) => void;
}

export function PipelineCard({ card, isDragging, onCardClick, onRejectClick }: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const initials = (card.name || 'Candidate')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none ${
        isDragging ? 'shadow-lg rotate-1 opacity-90' : ''
      }`}
      onClick={() => onCardClick(card.id)}
      role="button"
      aria-label={`${card.name} — click to view details`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onCardClick(card.id); }}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Initials avatar */}
        <div className="h-8 w-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{card.name}</p>
              {card.candidateCode && (
                <p className="text-xs font-mono text-gray-400">{card.candidateCode}</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRejectClick(card.id); }}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0 transition"
              aria-label={`Reject ${card.name}`}
              title="Reject candidate"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          {card.currentTitle && (
            <p className="text-xs text-gray-600 truncate mt-0.5 flex items-center gap-1">
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              {card.currentTitle}
              {card.currentCompany ? ` @ ${card.currentCompany}` : ''}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {card.experienceYears != null && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {card.experienceYears}y exp
              </span>
            )}
            {card.expectedSalary && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <IndianRupee className="h-3 w-3" />
                {card.expectedSalary}
              </span>
            )}
          </div>

          {card.skills && card.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {card.skills.slice(0, 3).map((skill) => (
                <span key={skill} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {skill}
                </span>
              ))}
              {card.skills.length > 3 && (
                <span className="text-xs text-gray-400">+{card.skills.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
