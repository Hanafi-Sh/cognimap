import React from 'react';
import { NodeData } from '../types';

interface ConnectionLayerProps {
  nodes: NodeData[];
}

export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({ nodes }) => {
  const nodeMap = new Map<string, NodeData>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const renderConnection = (node: NodeData) => {
    if (!node.parentId) return null;
    const parent = nodeMap.get(node.parentId);
    
    if (!parent || parent.collapsed) return null;

    // Use exact heights from layout engine (or fallback to safe default if not computed yet)
    const pH = parent.height || 100;
    const cH = node.height || 100;

    // Vertical Layout Connections: L-Shape
    // Start: Bottom Left of Parent Content
    // End: Left Center of Child
    
    const startX = parent.position.x + 30; // Indented start
    const startY = parent.position.y + pH; // Exact bottom of parent

    const endX = node.position.x;
    const endY = node.position.y + (cH / 2); // Center of child height

    const pathData = `M ${startX},${startY} L ${startX},${endY} L ${endX},${endY}`;

    return (
      <path
        key={`${parent.id}-${node.id}`}
        d={pathData}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeOpacity="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
      {nodes.map(renderConnection)}
    </svg>
  );
};