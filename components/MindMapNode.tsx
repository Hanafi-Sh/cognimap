
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, BookOpen, GripHorizontal, Edit3, X, Sparkles, Loader2, ChevronDown, ChevronRight, CheckCircle2, Maximize2, Minimize2, Minus } from 'lucide-react';
import { NodeData } from '../types';

// Helper to render Math using KaTeX
const renderMath = (latex: string, displayMode: boolean) => {
  if (typeof window !== 'undefined' && (window as any).katex) {
    try {
      return (window as any).katex.renderToString(latex, {
        displayMode,
        throwOnError: false
      });
    } catch (e) {
      console.warn("KaTeX error:", e);
      return latex;
    }
  }
  return latex;
};

// Helper to parse inline elements: Math -> Code -> Bold -> Italic
const parseInline = (text: string): React.ReactNode[] => {
  // Regex to split by Inline Math ($...$), Code (`...`), Bold (**...**)
  // Order matters! 
  const parts = text.split(/(\$.*?\$|`.*?`|\*\*.*?\*\*)/g);
  
  return parts.map((part, i) => {
    // Inline Math
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const content = part.slice(1, -1);
        const html = renderMath(content, false);
        return <span key={i} className="text-indigo-200 font-serif" dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // Code
    if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-slate-800 text-amber-200 px-1 py-0.5 rounded text-xs font-mono border border-slate-700">{part.slice(1, -1)}</code>;
    }

    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-indigo-100 font-bold">{part.slice(2, -2)}</strong>;
    }
    
    // Basic Italic handling (simplified for * only) within the remaining text
    const subParts = part.split(/(\*.*?\*)/g);
    return subParts.map((sp, j) => {
        if (sp.startsWith('*') && sp.endsWith('*') && sp.length > 2) {
             return <em key={`${i}-${j}`} className="text-indigo-200 not-italic">{sp.slice(1, -1)}</em>;
        }
        return sp;
    });
  }).flat(); // flatten because subParts creates nested arrays
};

// --- ROBUST MARKDOWN RENDERER ---
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  
  // 1. Split by Block Math ($$...$$) first
  const blocks = content.split(/(\$\$[\s\S]*?\$\$)/g);

  return (
    <div className="space-y-4 text-slate-300 leading-relaxed font-light">
      {blocks.map((block, blockIdx) => {
        // Handle Block Math
        if (block.startsWith('$$') && block.endsWith('$$')) {
            const tex = block.slice(2, -2).trim();
            const html = renderMath(tex, true);
            return (
                <div key={blockIdx} className="my-4 py-3 px-2 bg-slate-900/50 rounded overflow-x-auto flex justify-center">
                     <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
            );
        }

        // Handle Standard Markdown Lines
        // Normalize newlines from JSON escapes
        const normalized = block.replace(/\\n/g, '\n');
        const lines = normalized.split('\n');

        return lines.map((line, lineIdx) => {
            const trimmed = line.trim();
            const uniqueKey = `${blockIdx}-${lineIdx}`;
            
            if (!trimmed) return null; // Skip empty lines to avoid weird spacing, or add spacer if needed

            // Headers
            if (trimmed.startsWith('####')) {
                return <h4 key={uniqueKey} className="text-indigo-300 font-bold text-base mt-4 mb-1 tracking-wide">{parseInline(trimmed.replace(/^####\s+/, ''))}</h4>;
            }
            if (trimmed.startsWith('###')) {
                return <h3 key={uniqueKey} className="text-indigo-200 font-bold text-lg mt-6 mb-2 border-b border-indigo-500/30 pb-1">{parseInline(trimmed.replace(/^###\s+/, ''))}</h3>;
            }
            if (trimmed.startsWith('##')) {
                return <h2 key={uniqueKey} className="text-white font-bold text-xl mt-8 mb-3">{parseInline(trimmed.replace(/^##\s+/, ''))}</h2>;
            }

            // Fallback: Treat lines that are ONLY bold as headers
            if (trimmed.match(/^\*\*.*\*\*[:]?$/)) {
                return <h4 key={uniqueKey} className="text-indigo-200 font-bold text-base mt-5 mb-2">{parseInline(trimmed)}</h4>;
            }

            // Unordered Lists (- or *)
            if (trimmed.match(/^[-*]\s/)) {
                return (
                    <div key={uniqueKey} className="flex items-start gap-3 ml-2 group">
                        <span className="text-indigo-500 mt-2 text-[6px] shrink-0 group-hover:text-indigo-400 transition-colors">●</span>
                        <span className="text-slate-300">{parseInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
                    </div>
                );
            }

            // Ordered Lists (1. 2. etc)
            const orderedMatch = trimmed.match(/^(\d+)\.\s/);
            if (orderedMatch) {
                return (
                    <div key={uniqueKey} className="flex items-start gap-2 ml-2">
                        <span className="text-indigo-400 font-mono text-xs mt-1 shrink-0 select-none">{orderedMatch[1]}.</span>
                        <span className="text-slate-300">{parseInline(trimmed.replace(/^\d+\.\s+/, ''))}</span>
                    </div>
                )
            }

            // Blockquotes
            if (trimmed.startsWith('>')) {
                return (
                    <div key={uniqueKey} className="border-l-2 border-indigo-500/50 pl-4 py-1 my-2 text-slate-400 italic bg-slate-800/30 rounded-r">
                        {parseInline(trimmed.replace(/^>\s+/, ''))}
                    </div>
                )
            }

            // Regular Paragraph
            return <p key={uniqueKey} className="text-slate-300 text-[15px] mb-2">{parseInline(line)}</p>;
        });
      })}
    </div>
  );
};

interface MindMapNodeProps {
  node: NodeData;
  hasChildren: boolean;
  onUpdatePosition: (id: string, pos: { x: number; y: number }) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onLearn: (id: string, prompt: string) => Promise<void>;
  onToggleCollapse: (id: string) => void;
  onToggleContent: (id: string) => void; // New prop
  scale: number;
}

type NodeMode = 'idle' | 'input' | 'loading';

export const MindMapNode: React.FC<MindMapNodeProps> = ({
  node,
  hasChildren,
  onUpdatePosition,
  onAddChild,
  onDelete,
  onEdit,
  onLearn,
  onToggleCollapse,
  onToggleContent,
  scale
}) => {
  const [mode, setMode] = useState<NodeMode>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false); 
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const [promptInput, setPromptInput] = useState("");
  const nodeRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const isManualLoadingRef = useRef(false);

  const isRoot = node.nodeType === 'root';
  const isDetail = node.nodeType === 'detail';

  useEffect(() => {
    if (node.isLoading) {
        setMode('loading');
    } else if (mode === 'loading' && !node.isLoading && !isManualLoadingRef.current) {
        setMode('idle');
    }
  }, [node.isLoading, mode]);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
        const handleWheel = (e: WheelEvent) => {
            e.stopPropagation();
            e.stopImmediatePropagation(); 
        };
        // Use capture: true to stop bubbling phase to parent early
        // Add 'node.contentMinimized' as dependency to ensure listener is re-attached if DOM changes/mounts
        el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
        return () => el.removeEventListener('wheel', handleWheel, { capture: true });
    }
  }, [mode, isMaximized, node.contentMinimized]);

  useEffect(() => {
    if (mode === 'input' && !promptInput) {
        if (node.nodeType === 'root') setPromptInput("Jelaskan topik ini secara komprehensif.");
        if (node.nodeType === 'chapter') setPromptInput("Jelaskan komponen kuncinya.");
        if (node.nodeType === 'subchapter') setPromptInput("Berikan contoh dan penjelasan mendalam.");
    }
  }, [mode, node.nodeType]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) {
        e.stopPropagation(); // Prevent panning when interacting with modal
        return;
    }
    if (!isRoot) return;
    e.stopPropagation();
    if (e.button === 0 && !isEditing && mode === 'idle') {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dy = (e.clientY - dragStartRef.current.y) / scale;
      onUpdatePosition(node.id, {
        x: node.position.x + dx,
        y: node.position.y + dy,
      });
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, node.position, onUpdatePosition, scale, node.id]);

  const startEdit = () => { setEditValue(node.title); setIsEditing(true); };
  const saveEdit = () => { if (editValue.trim()) onEdit(node.id, editValue.trim()); setIsEditing(false); };
  const handleStartLearning = () => setMode('input');
  
  const handleTriggerLearn = async () => {
    if (hasChildren && node.collapsed) {
        onToggleCollapse(node.id);
        setMode('idle');
        return;
    }
    
    isManualLoadingRef.current = true;
    setMode('loading');

    try {
      await onLearn(node.id, promptInput);
      setMode('idle');
    } catch (e) {
      console.error(e);
      alert("Gagal membuat konten. Silakan coba lagi.");
      setMode('input');
    } finally {
      isManualLoadingRef.current = false;
    }
  };

  const getContainerStyles = () => {
    const base = "flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-xl backdrop-blur-md border shadow-xl";
    
    if (isMaximized) {
        // Fixed positioning relative to viewport (when Portaled)
        return `${base} fixed inset-4 md:inset-6 z-[100] bg-slate-900/95 border-indigo-500/50 shadow-2xl`;
    }

    let sizeClasses = isDetail ? "w-[550px]" : isRoot ? "w-[350px]" : "w-[400px]";
    let colorClasses = "";

    switch (node.nodeType) {
        case 'root': colorClasses = "z-20 bg-indigo-900/30 border-indigo-400/50 shadow-indigo-500/10 hover:shadow-indigo-500/30"; break;
        case 'chapter': colorClasses = "z-10 bg-slate-800/90 border-slate-500/50 hover:border-indigo-400/60"; break;
        case 'subchapter': colorClasses = "z-10 bg-slate-800/70 border-slate-600/50"; break;
        case 'detail': colorClasses = "z-10 bg-slate-900/80 border-slate-700/50"; break;
        default: colorClasses = "bg-slate-800 border-slate-700";
    }

    if (mode === 'input') {
        return `${base} absolute w-[400px] min-h-[250px] bg-slate-900/95 border-indigo-500/50 shadow-indigo-500/20 z-50`;
    }

    return `${base} absolute ${sizeClasses} ${colorClasses}`;
  };

  const getNodeLabel = () => {
      switch(node.nodeType) {
          case 'root': return 'Topik Utama';
          case 'chapter': return 'Bab';
          case 'subchapter': return 'Poin Pembelajaran';
          case 'detail': return 'Penjelasan Mendalam';
          default: return '';
      }
  }

  // JSX Construction
  const nodeJSX = (
    <div
      ref={nodeRef}
      style={!isMaximized ? { 
          transform: `translate(${node.position.x}px, ${node.position.y}px)`, 
          cursor: isRoot ? (isDragging ? 'grabbing' : 'grab') : 'default',
          height: (mode === 'idle' || mode === 'loading') && node.height ? node.height : 'auto'
      } : undefined}
      className={getContainerStyles()}
      onMouseDown={handleMouseDown}
      onWheel={(e) => e.stopPropagation()} // Stop canvas zoom when wheeling over node
    >
      <div className={`flex justify-between items-start p-5 ${node.contentMinimized ? 'pb-2' : 'pb-2'} shrink-0`}>
        <div className="flex flex-col w-full mr-4 overflow-hidden">
            {!isEditing && <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-2">
                {getNodeLabel()}
            </span>}
            {isEditing ? (
            <input 
                autoFocus className="w-full bg-slate-950 text-white px-2 py-1 rounded border border-indigo-500 outline-none text-lg font-medium"
                value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} onBlur={saveEdit}
            />
            ) : (
            <div 
                className={`font-bold select-none cursor-text w-full ${
                    isRoot ? 'text-2xl text-indigo-100' : 'text-lg text-slate-200'
                } ${
                    node.contentMinimized ? 'truncate' : 'leading-tight break-words'
                }`}
                onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
            >
                {node.title}
            </div>
            )}
        </div>
        
        <div className="flex items-center gap-2">
            {/* Loading indicator for minimized nodes */}
            {node.isLoading && node.contentMinimized && (
                <Loader2 size={16} className="text-indigo-400 animate-spin" />
            )}
            
            {/* Minimize Content Toggle */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleContent(node.id); }}
                className="text-slate-400 hover:text-indigo-300 transition-colors p-1 rounded hover:bg-slate-700/50"
                title={node.contentMinimized ? "Tampilkan Isi" : "Sembunyikan Isi"}
            >
                {node.contentMinimized ? <Plus size={16} /> : <Minus size={16} />}
            </button>

            {isDetail && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }} 
                    className="text-slate-400 hover:text-indigo-300 transition-colors p-1 rounded hover:bg-slate-700/50"
                    title={isMaximized ? "Kecilkan" : "Layar Penuh"}
                >
                    {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            )}
            {mode === 'idle' && isRoot && !isMaximized && (
                <div className="text-slate-400 cursor-grab ml-1">
                    <GripHorizontal size={20} />
                </div>
            )}
            {mode === 'input' && <button onClick={() => setMode('idle')} className="text-slate-500 hover:text-white"><X size={20} /></button>}
        </div>
      </div>

      {!node.contentMinimized && (
        <div className="flex-1 flex flex-col px-5 pb-5 min-h-0 relative">
          {mode === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-900/60 backdrop-blur-sm rounded-b-xl">
                <div className="bg-slate-900 border border-indigo-500/30 px-4 py-3 rounded-full flex items-center gap-3 shadow-xl">
                    <Loader2 size={20} className="text-indigo-400 animate-spin" />
                    <span className="text-sm text-indigo-200 font-medium animate-pulse">Sedang Berpikir...</span>
                </div>
            </div>
          )}

          {(mode === 'idle' || mode === 'loading') && (
            <>
              <div 
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative overscroll-y-contain"
              >
                  {node.data?.summary && (
                  <div className="mb-3 text-[15px] text-slate-300 leading-relaxed border-t border-slate-700/50 pt-3">
                      <MarkdownRenderer content={node.data.summary} />
                  </div>
                  )}
                  
                  {node.data?.learningPoints && (
                      <div className="mb-3 border-t border-slate-700/50 pt-3">
                          <ul className="space-y-2">
                              {node.data.learningPoints.map((point, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[14px] text-slate-300">
                                      <CheckCircle2 size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                                      <span>{point}</span>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  )}

                  {node.data?.details && (
                  <div className="mb-4 text-[15px] text-slate-300 border-t border-slate-700/50 pt-3">
                      <MarkdownRenderer content={node.data.details} />
                      
                      {node.data.bulletPoints && (
                          <div className="mt-8 bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                              <h5 className="text-xs uppercase tracking-widest text-indigo-400 mb-3 font-semibold">Poin Kunci</h5>
                              <ul className="space-y-2 text-sm text-slate-400">
                                  {node.data.bulletPoints.map((bp, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                          <span className="text-indigo-500/50 mt-1">•</span>
                                          <span>{parseInline(bp)}</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      )}
                  </div>
                  )}
              </div>

              <div className={`flex justify-between items-center pt-3 mt-2 border-t border-slate-700/50 shrink-0`}>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} className="p-1.5 rounded-full bg-slate-800 hover:bg-white/10 text-indigo-300 border border-transparent" title="Tambah manual"><Plus size={16} /></button>
                  {!isRoot && <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400"><Trash2 size={16} /></button>}
                  <button onClick={(e) => { e.stopPropagation(); startEdit(); }} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400"><Edit3 size={16} /></button>
                </div>
                
                <div className="flex items-center gap-2">
                  {hasChildren && !isMaximized && (
                      <button 
                          onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all ${node.collapsed ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                      >
                          {node.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          {node.collapsed ? 'Buka' : 'Tutup'}
                      </button>
                  )}

                  {node.nodeType !== 'detail' && (
                      <button
                      onClick={(e) => { e.stopPropagation(); handleStartLearning(); }}
                      disabled={mode === 'loading'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                      <BookOpen size={14} /> 
                      {mode === 'loading' ? 'Berpikir...' : (hasChildren ? 'Tambahkan' : (node.nodeType === 'subchapter' ? 'Jelaskan' : 'Buat'))}
                      </button>
                  )}
                </div>
              </div>
            </>
          )}

          {mode === 'input' && (
            <div className="flex flex-col h-full justify-center animate-in fade-in zoom-in-95 duration-300 mt-2">
              <h3 className="text-lg text-white font-medium mb-1">
                  {node.nodeType === 'root' ? 'Susun Materi Pembelajaran' : node.nodeType === 'chapter' ? 'Uraikan Topik' : 'Penjelasan Mendalam'}
              </h3>
              <p className="text-xs text-slate-400 mb-3">AI akan menganalisis dan menyusun langkah selanjutnya.</p>
              <textarea 
                autoFocus
                className="w-full h-24 bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none mb-3 placeholder:text-slate-600"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTriggerLearn()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <button 
                onClick={(e) => { e.stopPropagation(); handleTriggerLearn(); }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles size={16} /> Mulai
              </button>
            </div>
          )}
        </div>
      )}

      {/* Minimized Footer - Accessible Collapse Button */}
      {node.contentMinimized && hasChildren && !isMaximized && (
         <div className="px-5 pb-2 flex justify-end">
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all ${node.collapsed ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
            >
                {node.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {node.collapsed ? 'Buka' : 'Tutup'}
            </button>
         </div>
      )}
    </div>
  );

  if (isMaximized) {
    return createPortal(
      <>
        <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm" onClick={() => setIsMaximized(false)} />
        {nodeJSX}
      </>,
      document.body
    );
  }

  return nodeJSX;
};
