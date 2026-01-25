import type { PathNode as PathNodeType } from '../utils/pathGenerator';
import { PathNode } from './PathNode';

interface LearningPathProps {
  nodes: PathNodeType[];
  onNodeClick?: (node: PathNodeType) => void;
}

export function LearningPath({ nodes, onNodeClick }: LearningPathProps) {
  return (
    <div className="relative mt-6">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />
      <div className="flex flex-col gap-10">
        {nodes.map((node, index) => (
          <div
            key={node.id}
            className={`relative flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
          >
            <div className="relative">
              <div
                className={`absolute top-8 ${
                  index % 2 === 0 ? 'left-full' : 'right-full'
                } h-px w-10 bg-slate-200`}
              />
              <PathNode node={node} onClick={onNodeClick} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
