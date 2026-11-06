'use client';

import React, { useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { PipelineCardDTO, PipelineColumnDTO, JobPipelineHeaderDTO, ApplicationStatus } from '@hireflow/shared';
import { PipelineCard } from './PipelineCard';
import { PipelineColumn } from './PipelineColumn';
import { CandidateDrawer } from './CandidateDrawer';
import { RejectionModal } from './RejectionModal';
import { AddCandidateModal } from './AddCandidateModal';
import { transitionApplicationStageAction, loadMoreColumnAction } from '@/actions/pipeline';
import { UserPlus } from 'lucide-react';

interface PipelineBoardProps {
  initialColumns: PipelineColumnDTO[];
  header: JobPipelineHeaderDTO;
  jobId: string;
  currentUser: { id: string; name: string; role: string };
}

export function PipelineBoard({ initialColumns, header, jobId, currentUser }: PipelineBoardProps) {
  const [columns, setColumns] = useState<PipelineColumnDTO[]>(initialColumns);
  const [activeCard, setActiveCard] = useState<PipelineCardDTO | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  // Drawer state
  const [drawerApplicationId, setDrawerApplicationId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectionApplicationId, setRejectionApplicationId] = useState<string | null>(null);

  // Add candidate modal state
  const [showAddCandidate, setShowAddCandidate] = useState(false);

  // Interview scheduling placeholder state
  const [interviewApplicationId, setInterviewApplicationId] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // ── Drag Handlers ──────────────────────────────────────────────────────────

  function findCard(cardId: string): { card: PipelineCardDTO; colIdx: number; cardIdx: number } | null {
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx];
      const cardIdx = col.cards.findIndex((c) => c.id === cardId);
      if (cardIdx !== -1) return { card: col.cards[cardIdx], colIdx, cardIdx };
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findCard(String(event.active.id));
    if (found) {
      setActiveCard(found.card);
      setActiveColumn(columns[found.colIdx].stage.id);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const found = findCard(activeId);
    if (!found) return;

    // Over a column
    const overCol = columns.find((c) => c.stage.id === overId);
    if (overCol) {
      if (overCol.stage.id !== columns[found.colIdx].stage.id) {
        setColumns((prev) => {
          const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
          const [removed] = next[found.colIdx].cards.splice(found.cardIdx, 1);
          next[found.colIdx].totalCount -= 1;
          const toIdx = next.findIndex((c) => c.stage.id === overId);
          next[toIdx].cards.unshift(removed);
          next[toIdx].totalCount += 1;
          return next;
        });
      }
      return;
    }

    // Over a card
    const overFound = findCard(overId);
    if (!overFound) return;
    if (overFound.colIdx === found.colIdx) {
      // Same column reorder
      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
        next[found.colIdx].cards = arrayMove(next[found.colIdx].cards, found.cardIdx, overFound.cardIdx);
        return next;
      });
    } else {
      // Cross-column move
      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
        const [removed] = next[found.colIdx].cards.splice(found.cardIdx, 1);
        next[found.colIdx].totalCount -= 1;
        next[overFound.colIdx].cards.splice(overFound.cardIdx, 0, removed);
        next[overFound.colIdx].totalCount += 1;
        return next;
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    const cardId = String(active.id);
    const found = findCard(cardId);
    if (!found) return;

    // Determine target stage
    let targetStageId: string | null = null;
    const overColId = columns.find((c) => c.stage.id === String(over.id))?.stage.id;
    if (overColId) {
      targetStageId = overColId;
    } else {
      const overCard = findCard(String(over.id));
      if (overCard) targetStageId = columns[overCard.colIdx].stage.id;
    }

    if (!targetStageId) return;

    const sourceStageId = columns[found.colIdx].stage.id;

    // Check if it's the REJECTED stage — open rejection modal instead
    const targetCol = columns.find((c) => c.stage.id === targetStageId);
    if (targetCol?.stage.stageType === ApplicationStatus.REJECTED) {
      setRejectionApplicationId(found.card.id);
      return;
    }

    // Check if it's the INTERVIEW stage — show scheduling placeholder
    if (targetCol?.stage.stageType === ApplicationStatus.INTERVIEW) {
      setInterviewApplicationId(found.card.id);
    }

    if (targetStageId === sourceStageId) return;

    // Persist server-side
    startTransition(async () => {
      const result = await transitionApplicationStageAction(found.card.id, targetStageId!);
      if (!result.success) {
        // Rollback on failure
        setColumns(initialColumns);
        alert(`Failed to move candidate: ${result.error}`);
      }
    });
  }

  // ── Load More ──────────────────────────────────────────────────────────────

  async function handleLoadMore(stageId: string, cursor: string) {
    const result = await loadMoreColumnAction(jobId, stageId, cursor);
    if (result.error) return;
    setColumns((prev) =>
      prev.map((c) =>
        c.stage.id === stageId
          ? {
              ...c,
              cards: [...c.cards, ...result.cards],
              nextCursor: result.nextCursor,
              hasMore: Boolean(result.nextCursor),
            }
          : c
      )
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Add Candidate Button */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100">
        <p className="text-sm text-gray-500">
          Drag cards across columns or use keyboard navigation (Space to pick up, Arrow keys to move, Space to drop).
        </p>
        <button
          onClick={() => setShowAddCandidate(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition"
        >
          <UserPlus className="h-4 w-4" />
          Add Candidate
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 h-full min-h-0" style={{ minWidth: `${columns.length * 280 + 48}px` }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {columns.map((col) => (
              <SortableContext
                key={col.stage.id}
                items={col.cards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <PipelineColumn
                  column={col}
                  isActive={activeColumn === col.stage.id}
                  onCardClick={(appId) => setDrawerApplicationId(appId)}
                  onRejectClick={(appId) => setRejectionApplicationId(appId)}
                  onLoadMore={handleLoadMore}
                />
              </SortableContext>
            ))}

            <DragOverlay>
              {activeCard ? (
                <PipelineCard card={activeCard} isDragging onCardClick={() => {}} onRejectClick={() => {}} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Candidate Drawer */}
      {drawerApplicationId && (
        <CandidateDrawer
          applicationId={drawerApplicationId}
          onClose={() => setDrawerApplicationId(null)}
          onReject={(appId) => {
            setDrawerApplicationId(null);
            setRejectionApplicationId(appId);
          }}
        />
      )}

      {/* Rejection Modal */}
      {rejectionApplicationId && (
        <RejectionModal
          applicationId={rejectionApplicationId}
          jobId={jobId}
          onClose={() => setRejectionApplicationId(null)}
          onRejected={() => {
            setRejectionApplicationId(null);
            window.location.reload();
          }}
        />
      )}

      {/* Add Candidate Modal */}
      {showAddCandidate && (
        <AddCandidateModal
          jobId={jobId}
          onClose={() => setShowAddCandidate(false)}
          onAdded={() => {
            setShowAddCandidate(false);
            window.location.reload();
          }}
        />
      )}

      {/* Interview Scheduling Placeholder */}
      {interviewApplicationId && (
        <InterviewSchedulingPlaceholder
          applicationId={interviewApplicationId}
          jobId={jobId}
          onClose={() => setInterviewApplicationId(null)}
        />
      )}
    </>
  );
}

// ── Interview Scheduling Placeholder ─────────────────────────────────────────

function InterviewSchedulingPlaceholder({
  applicationId,
  jobId,
  onClose,
}: {
  applicationId: string;
  jobId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Schedule Interview</h2>
        <p className="text-sm text-gray-600 mb-4">
          The candidate has been moved to the Interview stage. Full interview scheduling (calendar integration, panel
          assignment, availability check) is ready in the Interviews module.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-blue-700 font-medium">
            💡 Navigate to <strong>Interviews → Schedule Interview</strong> to book a slot with the candidate.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
