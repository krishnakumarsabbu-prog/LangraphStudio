import React from 'react';
import { EdgeProps, getSmoothStepPath } from 'react-flow-renderer';
import { Settings } from 'lucide-react';

export const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}) => {
  const path = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  const handleButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (data?.onEdgeClick) {
      data.onEdgeClick({ id });
    }
  };

  return (
    <>
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#D71E28" />
        </marker>
      </defs>
      <g className="react-flow__edge">
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          className="react-flow__edge-interaction"
          style={{ cursor: 'pointer' }}
        />

        <path
          id={id}
          d={path}
          fill="none"
          stroke="#D71E28"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#arrow-${id})`}
          style={{ pointerEvents: 'visibleStroke' }}
        />

      <circle
        cx={labelX}
        cy={labelY}
        r={16}
        fill="white"
        stroke="#D71E28"
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onClick={handleButtonClick}
      />

      <foreignObject
        width={32}
        height={32}
        x={labelX - 16}
        y={labelY - 16}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex items-center justify-center w-full h-full">
          <Settings className="w-4 h-4 text-[#D71E28]" />
        </div>
      </foreignObject>

      {data?.condition && (
        <text
          x={labelX + 28}
          y={labelY + 5}
          fill="#D71E28"
          fontSize={12}
          fontWeight={600}
        >
          {data.condition}
        </text>
      )}
      </g>
    </>
  );
};
