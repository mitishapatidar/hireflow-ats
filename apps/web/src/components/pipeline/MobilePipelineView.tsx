'use client';

import React, { useState } from 'react';
import {
  PipelineColumnDTO,
  ApplicationStatus,
} from '@hireflow/shared';
import {
  Users,
  ChevronRight,
  ArrowRight,
  XCircle,
  Briefcase,
  MapPin,
  Tag,
} from 'lucide-react';

interface MobilePipelineViewProps {
  columns: PipelineColumnDTO[];
  onSelectCandidate: (applicationId: string) => void;
  onAdvanceStage: (applicationId: string, currentStageType: ApplicationStatus) => void;
  onRejectCandidate: (applicationId: string) => void;
}

export function MobilePipelineView({
  columns,
  onSelectCandidate,
  onAdvanceStage,
  onRejectCandidate,
}: MobilePipelineViewProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>(
    columns[0]?.stage.id || ''
  );

  const activeColumn =
    columns.find((c) => c.stage.id === selectedStageId) || columns[0];
  const cards = activeColumn?.cards || [];

  return (
    <div className="md:hidden flex flex-col space-y-4 p-4">
      {/* 1. HORIZONTAL TOUCH STAGE SWITCHER (FRAME 47) */}
      <div className="bg-white border border-[#E6E8F0] rounded-xl p-2 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {columns.map((col) => {
            const isSelected = col.stage.id === (activeColumn?.stage.id ?? '');
            return (
              <button
                key={col.stage.id}
                onClick={() => setSelectedStageId(col.stage.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 min-h-[44px] cursor-pointer ${
                  isSelected
                    ? 'bg-[#5B49D6] text-white shadow-xs'
                    : 'bg-[#F6F7FB] text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                <span>{col.stage.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#E6E8F0] text-[#1B2236]'
                  }`}
                >
                  {col.totalCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. ACTIVE STAGE SUMMARY */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="font-bold text-[#1B2236] uppercase tracking-wider text-[11px]">
          {activeColumn?.stage.name} Candidates ({activeColumn?.totalCount || 0})
        </span>
        <span className="text-[11px] text-[#6B7490]">Tap card to view profile</span>
      </div>

      {/* 3. VERTICAL CANDIDATE CARDS LIST */}
      <div className="space-y-3">
        {cards.length === 0 ? (
          <div className="bg-white border border-[#E6E8F0] rounded-2xl p-8 text-center text-xs text-[#6B7490] space-y-1">
            <Users className="w-8 h-8 text-[#6B7490]/40 mx-auto mb-2" />
            <p className="font-semibold text-[#1B2236]">No candidates in {activeColumn?.stage.name}</p>
            <p className="text-[11px]">Advance candidates from earlier stages or source new applicants.</p>
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              onClick={() => onSelectCandidate(card.id)}
              className="bg-white border border-[#E6E8F0] rounded-xl p-4 shadow-2xs hover:border-[#5B49D6]/40 transition-colors space-y-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-[#1B2236]">{card.name}</h4>
                  <p className="text-xs text-[#6B7490] mt-0.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-[#5B49D6]" />
                    <span>{card.currentTitle || card.currentCompany || 'Candidate'}</span>
                  </p>
                  {card.location && (
                    <p className="text-[11px] text-[#6B7490] mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#6B7490]" />
                      <span>{card.location}</span>
                    </p>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F7FB] border border-[#E6E8F0] text-[#6B7490]">
                  {card.candidateCode}
                </span>
              </div>

              {card.skills && card.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {card.skills.slice(0, 3).map((sk, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-[#EEEBFB] text-[#5B49D6] text-[10px] font-medium"
                    >
                      {sk}
                    </span>
                  ))}
                  {card.skills.length > 3 && (
                    <span className="text-[10px] text-[#6B7490] self-center">
                      +{card.skills.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons with 44px min-height for touch */}
              <div
                className="flex items-center justify-between pt-2 border-t border-[#E6E8F0] gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onRejectCandidate(card.id)}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-[#FECDCA] bg-white text-[#D92D20] text-xs font-semibold hover:bg-[#FEE4E2] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>

                {activeColumn?.stage.stageType !== 'PLACED' && activeColumn?.stage.stageType !== 'REJECTED' && (
                  <button
                    onClick={() => onAdvanceStage(card.id, activeColumn.stage.stageType)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#5B49D6] text-white text-xs font-semibold hover:bg-[#4a39b8] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Advance Stage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
