
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { NodeData, CanvasState, Position, GeneratedChapter } from './types';
import { MindMapNode } from './components/MindMapNode';
import { ConnectionLayer } from './components/ConnectionLayer';
import { BrainCircuit, MousePointer2, Save, FolderOpen, RotateCcw, PlusCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { generateChapters, generateSubChapters, generateDetails, generateTopicTitle } from './services/aiService';

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_ROOT: NodeData = {
  id: 'root',
  parentId: null,
  title: 'Topik Utama',
  position: { x: window.innerWidth / 2 - 200, y: 100 }, 
  level: 0,
  nodeType: 'root',
  collapsed: false,
  contentMinimized: true, // Default minimized
  height: 180, // Increased from 140 to 180 for better UI spacing
  isLoading: false
};

// --- LAYOUT ENGINE ---

const INDENT_X = 80; 
const GAP_Y = 40;   

const getNodeHeight = (node: NodeData): number => {
  // If content is minimized, return fixed header height
  if (node.contentMinimized) return 80; 

  if (node.nodeType === 'root') return 180; // Increased from 140
  if (node.nodeType === 'detail') return 550; 
  // Slightly larger for Subchapters to accommodate the list of points
  if (node.data?.learningPoints) return 320;
  if (node.data?.summary) return 260;
  return 120;
};

const computeSmartLayout = (nodes: NodeData[]): NodeData[] => {
  // Identify ALL roots (nodes with type 'root' or no parent)
  const roots = nodes.filter(n => n.nodeType === 'root' || !n.parentId);
  
  const childrenMap = new Map<string, NodeData[]>();
  nodes.forEach(n => {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n);
      childrenMap.set(n.parentId, list);
    }
  });

  const newNodes = [...nodes];
  const positionMap = new Map<string, Position>();
  const heightMap = new Map<string, number>();

  const layoutNode = (nodeId: string, x: number, y: number): number => {
    const nodeIndex = newNodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return 0;
    const node = newNodes[nodeIndex];

    positionMap.set(nodeId, { x, y });
    
    const myHeight = getNodeHeight(node);
    heightMap.set(nodeId, myHeight);

    if (node.collapsed) {
      return myHeight;
    }

    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      return myHeight;
    }

    let currentChildY = y + myHeight + GAP_Y;
    const childX = x + INDENT_X; 

    let totalSubTreeHeight = myHeight + GAP_Y;

    children.forEach(child => {
      const childHeight = layoutNode(child.id, childX, currentChildY);
      const effectiveHeight = childHeight + GAP_Y;
      currentChildY += effectiveHeight;
      totalSubTreeHeight += effectiveHeight;
    });

    return totalSubTreeHeight;
  };

  // Process EACH root independently
  roots.forEach(root => {
     layoutNode(root.id, root.position.x, root.position.y);
  });

  return newNodes.map(n => {
    const pos = positionMap.get(n.id);
    const h = heightMap.get(n.id);
    if (pos && h) {
        return { ...n, position: pos, height: h };
    }
    return n;
  });
};

const App: React.FC = () => {
  const [nodes, setNodes] = useState<NodeData[]>(() => {
    const saved = localStorage.getItem('cognimap-nodes');
    const initial = saved ? JSON.parse(saved) : [INITIAL_ROOT];
    const migrated = initial.map((n: any) => ({...n, contentMinimized: n.contentMinimized ?? true}));
    return computeSmartLayout(migrated);
  });
  
  const [canvasState, setCanvasState] = useState<CanvasState>({ offset: { x: 0, y: 0 }, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Position | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    localStorage.setItem('cognimap-nodes', JSON.stringify(nodes)); 
  }, [nodes]);

  // Visibility Logic
  const visibleNodes = useMemo(() => {
    const visibleSet = new Set<string>();
    
    // All roots are visible
    const roots = nodes.filter(n => n.nodeType === 'root' || !n.parentId);
    roots.forEach(r => visibleSet.add(r.id));

    const queue = [...roots];
    
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visibleSet.has(current.id) && !current.collapsed) {
            const children = nodes.filter(n => n.parentId === current.id);
            children.forEach(child => {
                visibleSet.add(child.id);
                queue.push(child);
            });
        }
    }
    return nodes.filter(n => visibleSet.has(n.id));
  }, [nodes]);

  const handleUpdatePosition = (id: string, newPos: Position) => {
    setNodes((prev) => {
       const updated = prev.map((node) => (node.id === id ? { ...node, position: newPos } : node));
       return computeSmartLayout(updated);
    });
  };

  const handleAddRoot = () => {
      // Calculate center of current viewport
      const viewportCenterX = (window.innerWidth / 2 - canvasState.offset.x) / canvasState.scale;
      const viewportCenterY = (window.innerHeight / 2 - canvasState.offset.y) / canvasState.scale;

      const newRoot: NodeData = {
          id: generateId(),
          parentId: null,
          title: 'Topik Baru',
          position: { x: viewportCenterX - 175, y: viewportCenterY - 70 }, // Center minus half size
          level: 0,
          nodeType: 'root',
          collapsed: false,
          contentMinimized: true,
          height: 180,
          isLoading: false
      };
      
      setNodes(prev => computeSmartLayout([...prev, newRoot]));
  };

  const handleAddChild = (parentId: string) => {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;

    const newNode: NodeData = {
      id: generateId(),
      parentId,
      title: 'Node Baru',
      position: { x: parent.position.x + INDENT_X, y: parent.position.y + 100 },
      level: parent.level + 1,
      nodeType: parent.nodeType === 'root' ? 'chapter' : parent.nodeType === 'chapter' ? 'subchapter' : 'detail',
      collapsed: false,
      contentMinimized: true // Default minimized
    };

    setNodes((prev) => computeSmartLayout([...prev, newNode]));
    if (parent.collapsed) {
        handleToggleCollapse(parentId);
    }
  };

  const handleDelete = (id: string) => {
    const deleteRecursive = (nodeId: string, currentNodes: NodeData[]): NodeData[] => {
      const children = currentNodes.filter((n) => n.parentId === nodeId);
      let remaining = currentNodes.filter((n) => n.id !== nodeId);
      children.forEach((child) => {
        remaining = deleteRecursive(child.id, remaining);
      });
      return remaining;
    };
    setNodes((prev) => computeSmartLayout(deleteRecursive(id, prev)));
  };

  const handleEdit = (id: string, newTitle: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title: newTitle } : n)));
  };

  const handleToggleCollapse = (id: string) => {
      setNodes(prev => computeSmartLayout(prev.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n)));
  };

  const handleToggleContent = (id: string) => {
      setNodes(prev => computeSmartLayout(prev.map(n => n.id === id ? { ...n, contentMinimized: !n.contentMinimized } : n)));
  }

  const handleLearnNode = async (id: string, prompt: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    if (node.nodeType === 'root') {
      try {
        // 1. Generate concise topic title
        const conciseTitle = await generateTopicTitle(prompt);
        
        // Update Main Node Title immediately
        setNodes(prev => prev.map(n => n.id === id ? { ...n, title: conciseTitle } : n));

        const chapters = await generateChapters(conciseTitle, prompt);
        
        const chapterNodes: NodeData[] = chapters.map((ch, index) => ({
            id: generateId(),
            parentId: node.id,
            title: `${index + 1}. ${ch.title}`, // Simple 1. 2. 3.
            position: { x: 0, y: 0 },
            level: node.level + 1,
            nodeType: 'chapter',
            collapsed: true, 
            contentMinimized: true,
            data: { summary: ch.briefDescription }
        }));

        let currentNodes = computeSmartLayout([...nodes, ...chapterNodes]);
        
        // Persist title update
        currentNodes = currentNodes.map(n => n.id === id ? { ...n, title: conciseTitle } : n);
        setNodes(currentNodes);

        // Waterfall generation - LIMIT TO FIRST 3 CHAPTERS
        (async () => {
            const nodesToProcess = chapterNodes.slice(0, 3); // Only expand the first 3 automatically
            
            for (const chNode of nodesToProcess) {
                setNodes(prev => prev.map(n => n.id === chNode.id ? { ...n, isLoading: true } : n));
                
                // Extract Chapter Number (e.g. "1" from "1. Pendahuluan")
                const match = chNode.title.match(/^(\d+)\./);
                const chapterNum = match ? match[1] : '0';

                try {
                    const subChapters = await generateSubChapters(conciseTitle, chNode.title, prompt);
                    const subNodes: NodeData[] = subChapters.map((sub, index) => {
                        // Remove any existing numbering from AI response (e.g. "1.2 Konsep" -> "Konsep")
                        const cleanTitle = sub.title.replace(/^[\d.]+\s*/, '');
                        
                        return {
                            id: generateId(),
                            parentId: chNode.id,
                            title: `${chapterNum}.${index + 1} ${cleanTitle}`, // Format 1.1, 1.2
                            position: { x: 0, y: 0 },
                            level: chNode.level + 1,
                            nodeType: 'subchapter',
                            collapsed: true,
                            contentMinimized: true,
                            data: { learningPoints: sub.learningPoints }
                        };
                    });
                    
                    setNodes(prev => {
                        const updated = [...prev, ...subNodes].map(n => 
                            n.id === chNode.id ? { ...n, isLoading: false, collapsed: false } : n
                        );
                        return computeSmartLayout(updated);
                    });

                } catch (err) {
                    console.error("Error generating subchapters for", chNode.title, err);
                    setNodes(prev => prev.map(n => n.id === chNode.id ? { ...n, isLoading: false } : n));
                }
                await new Promise(r => setTimeout(r, 500)); 
            }
        })();

      } catch (error) {
        console.error("Failed to generate chapters", error);
        throw error;
      }
    }
    else if (node.nodeType === 'chapter') {
         // Extract Chapter Number if possible
         const match = node.title.match(/^(\d+)\./);
         const chapterNum = match ? match[1] : '1';

         try {
            const subChapters = await generateSubChapters("Topik", node.title, prompt);
            const newNodes: NodeData[] = subChapters.map((sub, index) => {
                // Remove any existing numbering from AI response
                const cleanTitle = sub.title.replace(/^[\d.]+\s*/, '');

                return {
                    id: generateId(),
                    parentId: node.id,
                    title: `${chapterNum}.${index + 1} ${cleanTitle}`, // Format 1.1, 1.2
                    position: { x: 0, y: 0 },
                    level: node.level + 1,
                    nodeType: 'subchapter',
                    collapsed: true,
                    contentMinimized: true,
                    data: { learningPoints: sub.learningPoints }
                };
            });
            setNodes(prev => computeSmartLayout([...prev, ...newNodes]));
         } catch (e) {
             console.error("Error expanding chapter manually", e);
             alert("Gagal menguraikan bab.");
         }
    }
    else if (node.nodeType === 'subchapter') {
        const pointsToCover = node.data?.learningPoints || [];
        if (pointsToCover.length === 0) pointsToCover.push(node.title);

        const placeholders: NodeData[] = pointsToCover.map(point => ({
            id: generateId(),
            parentId: node.id,
            title: point,
            position: { x: 0, y: 0 },
            level: node.level + 1,
            nodeType: 'detail',
            collapsed: false,
            contentMinimized: true,
            isLoading: true,
            data: { details: '' }
        }));

        setNodes(prev => computeSmartLayout([...prev, ...placeholders]));

        (async () => {
            for (const phNode of placeholders) {
                try {
                    const detail = await generateDetails(node.title, prompt, phNode.title);
                    setNodes(prev => {
                        const updated = prev.map(n => {
                            if (n.id === phNode.id) {
                                return {
                                    ...n,
                                    title: detail.title,
                                    isLoading: false,
                                    data: { 
                                        details: detail.comprehensiveExplanation,
                                        bulletPoints: detail.corePoints 
                                    }
                                };
                            }
                            return n;
                        });
                        return computeSmartLayout(updated);
                    });
                } catch (err) {
                     console.error("Error generating detail for", phNode.title, err);
                     setNodes(prev => prev.map(n => n.id === phNode.id ? { ...n, isLoading: false, title: "Gagal Memuat" } : n));
                }
                await new Promise(r => setTimeout(r, 300)); 
            }
        })();
    }
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(0.1, canvasState.scale + delta), 3);

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      const worldX = (mouseX - canvasState.offset.x) / canvasState.scale;
      const worldY = (mouseY - canvasState.offset.y) / canvasState.scale;

      const newOffsetX = mouseX - worldX * newScale;
      const newOffsetY = mouseY - worldY * newScale;

      setCanvasState({ scale: newScale, offset: { x: newOffsetX, y: newOffsetY } });
    } else {
      setCanvasState((prev) => ({
        ...prev,
        offset: { x: prev.offset.x - e.deltaX, y: prev.offset.y - e.deltaY },
      }));
    }
  }, [canvasState]);

  useEffect(() => {
    const ele = containerRef.current;
    if (ele) {
      ele.addEventListener('wheel', handleWheel, { passive: false });
      return () => ele.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleZoomIn = () => {
    setCanvasState(prev => ({
        ...prev,
        scale: Math.min(prev.scale + 0.2, 3)
    }));
  };

  const handleZoomOut = () => {
    setCanvasState(prev => ({
        ...prev,
        scale: Math.max(prev.scale - 0.2, 0.1)
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setCanvasState((prev) => ({
      ...prev,
      offset: { x: prev.offset.x + dx, y: prev.offset.y + dy },
    }));
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const saveMap = () => {
    const data = JSON.stringify(nodes);
    localStorage.setItem('cognimap-save', data);
    alert("Peta Tersimpan!");
  };

  const loadMap = () => {
    const saved = localStorage.getItem('cognimap-save');
    if (saved) {
        setNodes(computeSmartLayout(JSON.parse(saved)));
    } else {
        alert("Tidak ada peta tersimpan.");
    }
  };
  
  const resetView = () => {
      const root = nodes.find(n => n.nodeType === 'root');
      if (root) {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        setCanvasState({
            scale: 1,
            offset: {
                x: viewportW / 2 - root.position.x - 175,
                y: viewportH / 2 - root.position.y - 70
            }
        })
      }
  }

  return (
    <div className="w-screen h-screen bg-[#0f172a] overflow-hidden relative select-none">
      <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" 
        style={{ backgroundPosition: `${canvasState.offset.x}px ${canvasState.offset.y}px`, backgroundSize: `${24 * canvasState.scale}px ${24 * canvasState.scale}px` }}
      />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-slate-800/90 p-2 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
          <BrainCircuit className="text-indigo-400" />
          <span className="font-bold text-indigo-100 pr-2">CogniMap</span>
        </div>
        <div className="flex gap-2">
            <button onClick={handleAddRoot} className="bg-indigo-600/90 hover:bg-indigo-500 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20 transition-colors" title="Topik Baru"><PlusCircle size={18} /></button>
            <div className="w-px bg-slate-700 mx-1"></div>
            <button onClick={handleZoomIn} className="bg-slate-800/80 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700" title="Zoom In"><ZoomIn size={18} /></button>
            <button onClick={handleZoomOut} className="bg-slate-800/80 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700" title="Zoom Out"><ZoomOut size={18} /></button>
            <div className="w-px bg-slate-700 mx-1"></div>
            <button onClick={saveMap} className="bg-slate-800/80 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700" title="Simpan Peta"><Save size={18} /></button>
            <button onClick={loadMap} className="bg-slate-800/80 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700" title="Muat Peta"><FolderOpen size={18} /></button>
            <button onClick={resetView} className="bg-slate-800/80 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700" title="Reset Tampilan"><RotateCcw size={18} /></button>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-50 bg-slate-800/80 px-3 py-1 rounded-full text-xs text-slate-400 border border-slate-700 pointer-events-none backdrop-blur-md">
        {Math.round(canvasState.scale * 100)}% | {visibleNodes.length} Nodes
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${canvasState.offset.x}px, ${canvasState.offset.y}px) scale(${canvasState.scale})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          <ConnectionLayer nodes={visibleNodes} />
          
          {visibleNodes.map((node) => (
            <MindMapNode
              key={node.id}
              node={node}
              hasChildren={nodes.some(n => n.parentId === node.id)}
              onUpdatePosition={handleUpdatePosition}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onLearn={handleLearnNode}
              onToggleCollapse={handleToggleCollapse}
              onToggleContent={handleToggleContent}
              scale={canvasState.scale}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
