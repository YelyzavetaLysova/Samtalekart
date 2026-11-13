import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { ConversationMapData, MapNodeData } from "../types";

type MapNodeValue = { label: string; tentative?: boolean };

function TopicNode({ data, selected }: NodeProps<Node<MapNodeValue>>) {
  return (
    <div className={`map-node ${selected ? "selected" : ""} ${data.tentative ? "tentative" : ""}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {data.label}
      {data.tentative && <span>ny</span>}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

function position(index: number, total: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: 220 + Math.cos(angle) * 165, y: 150 + Math.sin(angle) * 115 };
}

export function ConversationMap({
  map,
  selectedNode,
  onSelect,
}: {
  map: ConversationMapData;
  selectedNode: string | null;
  onSelect: (node: MapNodeData) => void;
}) {
  const nodes: Node<MapNodeValue>[] = [
    {
      id: "root",
      type: "topic",
      position: { x: 210, y: 145 },
      data: { label: map.root_label },
      draggable: false,
      selectable: false,
    },
    ...map.nodes.map((node, index) => ({
      id: node.id,
      type: "topic",
      position: position(index, map.nodes.length),
      data: { label: node.label, tentative: node.tentative },
      draggable: false,
      selected: selectedNode === node.id,
    })),
  ];
  const edges: Edge[] = map.nodes.map((node) => ({
    id: `root-${node.id}`,
    source: "root",
    target: node.id,
    animated: node.tentative,
    style: { stroke: node.tentative ? "#a06b36" : "#9aa39c", strokeWidth: 1.5 },
  }));

  return (
    <div className="map-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.55}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnDoubleClick={false}
        onNodeClick={(_, node) => {
          const value = map.nodes.find((item) => item.id === node.id);
          if (value) onSelect(value);
        }}
      >
        <Background color="#d9ded9" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

