'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { PipelineColumnDTO, ApplicationStatus } from '@hireflow/shared';
import { PipelineCard } from './PipelineCard';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTransition } from 'react';

interface PipelineColumnProps {
  column: PipelineColumnDTO;
  isActive: boolean;
  onCardClick: (applicationId: string) => void;
  onRejectClick: (applicationId: string) => void;
  onLoadMore: (stageId: string, cursor: string) => Promise<void>;
}

const STAGE_COLORS: Record<string, string> = {
  SOURCED: 'bg-gray-100 border-gray-300 text-gray-700',
  SCREENING: 'bg-blue-50 border-blue-200 text-blue-700',
  INTERVIEW: 'bg-purple-50 border-purple-200 text-purple-700',
  TECHNICAL: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  CLIENT_REVIEW: 'bg-orange-50 border-orange-200 text-orange-700',
  OFFER: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  PLACED: 'bg-green-50 border-green-200 text-green-700',
  REJECTED: 'bg-red-50 border-red-200 text-red-700',
};

export function PipelineColumn({
  column,
  isActive,
  onCardClick,
  onRejectClick,
  onLoadMore,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const [isLoading, startTransition] = useTransition();

  const colorClass = STAGE_COLORS[column.stage.stageType] ?? 'bg-gray-50 border-gray-200 text-gray-700';

  function handleLoadMore() {
    if (!column.nextCursor) return;
    startTransition(async () => {
      await onLoadMore(column.stage.id, column.nextCursor!);
    });
  }

  return (
    <div
      className={`flex flex-col w-[264px] flex-shrink-0 rounded-xl border transition-shadow ${
        isOver ? 'ring-2 ring-blue-400 shadow-lg' : 'shadow-sm'
      } ${isActive ? 'opacity-50' : ''}`}
    >
      {/* Column Header */}
      <div className={`px-3 py-2.5 rounded-t-xl border-b ${colorClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide">{column.stage.name}</span>
          <span className="text-xs font-bold bg-white/60 px-1.5 py-0.5 rounded-full">
            {column.totalCount}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-2 overflow-y-auto flex-1 min-h-[120px] max-h-[calc(100vh-240px)] bg-white rounded-b-xl transition-colors ${
          isOver ? 'bg-blue-50/40' : ''
        }`}
      >
        {column.cards.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-gray-400 italic">
            Drop candidates here
          </div>
        ) : (
          column.cards.map((card) => (
            <PipelineCard
              key={card.id}
              card={card}
              onCardClick={onCardClick}
              onRejectClick={onRejectClick}
            />
          ))
        )}

        {/* Load More */}
        {column.hasMore && column.nextCursor && (
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="flex items-center justify-center gap-1 py-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Load more ({column.totalCount - column.cards.length} remaining)
          </button>
        )}
      </div>
    </div>
  );
}
