import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ReasoningStep } from '../../types';

interface ReasoningFlowProps {
  steps: ReasoningStep[];
  classification: string;
  confidence: number;
}

export const ReasoningFlow: React.FC<ReasoningFlowProps> = ({ steps, classification, confidence }) => {
  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[#253340] pb-1.5">
        <span className="text-[11px] font-semibold text-[#3DB7D9] uppercase tracking-wider">
          WHY THIS WAS FLAGGED
        </span>
        <span className="text-[10px] text-[#A7B4C1] bg-[#0D151E] px-2 py-0.5 rounded border border-[#253340]">
          CONFIDENCE: <strong className="text-[#39B978]">{confidence}%</strong>
        </span>
      </div>

      <div className="relative pl-4 space-y-2.5 border-l border-[#253340]">
        {steps.map((step) => {
          let icon = <CheckCircle2 className="w-3.5 h-3.5 text-[#39B978]" />;
          let dotBg = 'bg-[#0D151E] border-[#39B978]/50';

          if (step.status === 'critical') {
            icon = <AlertOctagon className="w-3.5 h-3.5 text-[#F04438]" />;
            dotBg = 'bg-[#F04438]/10 border-[#F04438]/60';
          } else if (step.status === 'warning') {
            icon = <AlertTriangle className="w-3.5 h-3.5 text-[#E8A93A]" />;
            dotBg = 'bg-[#E8A93A]/10 border-[#E8A93A]/60';
          }

          return (
            <div key={step.stepIndex} className="relative group">
              <div
                className={`absolute -left-[22px] top-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${dotBg}`}
              >
                {icon}
              </div>

              <div className="bg-[#0D151E] border border-[#253340] rounded p-2 text-xs space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#A7B4C1] font-semibold uppercase">
                    STAGE 0{step.stepIndex} &mdash; {step.label}
                  </span>
                </div>
                <p className="text-slate-200 text-[11px] leading-relaxed font-sans">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2 bg-[#0D151E] border border-[#253340] rounded text-center">
        <span className="text-[10px] text-[#A7B4C1] uppercase tracking-wider block">DETERMINISTIC VERDICT</span>
        <span className="text-xs font-semibold text-white block">{classification}</span>
      </div>
    </div>
  );
};
