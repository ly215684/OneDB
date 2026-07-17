import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { getERData } from '../../services/connectionService';
import { Button } from '../ui/Button';
import { RefreshCw, ZoomIn, ZoomOut, Maximize2, Key, Link } from 'lucide-react';

interface ERDiagramProps {
  connectionId?: string;
  database?: string;
}

interface TableNode {
  name: string;
  columns: { name: string; type: string; pk: boolean; fk: string | null }[];
  x: number;
  y: number;
}

interface Relation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

const TABLE_WIDTH = 220;
const COLUMN_HEIGHT = 24;
const HEADER_HEIGHT = 32;

export function ERDiagram({ connectionId, database }: ERDiagramProps) {
  const { t } = useTranslation();
  const getConnection = useConnectionStore((s) => s.getConnection);
  const conn = connectionId ? getConnection(connectionId) : undefined;

  const [tables, setTables] = useState<TableNode[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ tableIdx: number; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchData = async () => {
    if (!conn || !database) {
      setError('No connection or database selected');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getERData(conn.type, conn.config, database);
      const cols = Math.ceil(Math.sqrt(data.tables.length));
      const nodes: TableNode[] = data.tables.map((tbl, i) => ({
        name: tbl.name,
        columns: tbl.columns.map((c) => ({
          name: c.name,
          type: c.type,
          pk: c.pk,
          fk: c.fk,
        })),
        x: (i % cols) * 280 + 40,
        y: Math.floor(i / cols) * 250 + 40,
      }));
      setTables(nodes);
      setRelations(
        data.relations.map((r) => ({
          fromTable: r.from_table,
          fromColumn: r.from_column,
          toTable: r.to_table,
          toColumn: r.to_column,
        })),
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [connectionId, database]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPanning({ startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y });
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / zoom - dragging.offsetX;
      const y = (e.clientY - rect.top) / zoom - dragging.offsetY;
      setTables((prev) => {
        const next = [...prev];
        next[dragging.tableIdx] = { ...next[dragging.tableIdx], x, y };
        return next;
      });
    } else if (panning) {
      setPan({
        x: panning.startPanX + (e.clientX - panning.startX),
        y: panning.startPanY + (e.clientY - panning.startY),
      });
    }
  }, [dragging, panning, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(null);
  }, []);

  const handleTableDragStart = (idx: number, e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = (e.clientX - rect.left) / zoom - tables[idx].x;
    const offsetY = (e.clientY - rect.top) / zoom - tables[idx].y;
    setDragging({ tableIdx: idx, offsetX, offsetY });
    e.stopPropagation();
  };

  const getTableHeight = (tbl: TableNode) => HEADER_HEIGHT + tbl.columns.length * COLUMN_HEIGHT + 4;

  const getRelationPath = (rel: Relation) => {
    const fromTbl = tables.find((t) => t.name === rel.fromTable);
    const toTbl = tables.find((t) => t.name === rel.toTable);
    if (!fromTbl || !toTbl) return null;

    const fromColIdx = fromTbl.columns.findIndex((c) => c.name === rel.fromColumn);
    const toColIdx = toTbl.columns.findIndex((c) => c.name === rel.toColumn);
    if (fromColIdx < 0 || toColIdx < 0) return null;

    const x1 = fromTbl.x + TABLE_WIDTH;
    const y1 = fromTbl.y + HEADER_HEIGHT + fromColIdx * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;
    const x2 = toTbl.x;
    const y2 = toTbl.y + HEADER_HEIGHT + toColIdx * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;
    const midX = (x1 + x2) / 2;

    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw size={14} className="mr-1" />{t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-toolbar flex-shrink-0">
        <span className="text-xs font-medium">ER Diagram</span>
        {database && <span className="text-2xs text-muted-foreground">({database})</span>}
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
          <ZoomIn size={14} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>
          <ZoomOut size={14} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetView}>
          <Maximize2 size={14} />
        </Button>
        <span className="text-2xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('er.noTables', 'No tables found')}
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ cursor: panning ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Relations */}
              {relations.map((rel, i) => {
                const path = getRelationPath(rel);
                if (!path) return null;
                return (
                  <g key={`rel-${i}`}>
                    <path d={path} fill="none" stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
                  </g>
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Tables */}
              {tables.map((tbl, idx) => (
                <g key={tbl.name} transform={`translate(${tbl.x}, ${tbl.y})`}>
                  {/* Header */}
                  <rect
                    width={TABLE_WIDTH}
                    height={HEADER_HEIGHT}
                    rx={4}
                    fill="#3b82f6"
                    className="cursor-move"
                    onMouseDown={(e) => handleTableDragStart(idx, e)}
                  />
                  <text x={10} y={21} fill="white" fontSize={12} fontWeight="bold">{tbl.name}</text>
                  {/* Body */}
                  <rect
                    y={HEADER_HEIGHT}
                    width={TABLE_WIDTH}
                    height={tbl.columns.length * COLUMN_HEIGHT + 4}
                    fill="white"
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    rx={0}
                  />
                  {tbl.columns.map((col, ci) => (
                    <g key={col.name} transform={`translate(0, ${HEADER_HEIGHT + ci * COLUMN_HEIGHT})`}>
                      <rect width={TABLE_WIDTH} height={COLUMN_HEIGHT} fill={ci % 2 === 0 ? '#f8fafc' : 'white'} />
                      <line x1={0} y1={COLUMN_HEIGHT} x2={TABLE_WIDTH} y2={COLUMN_HEIGHT} stroke="#e2e8f0" strokeWidth={0.5} />
                      {/* PK/FK icons */}
                      {col.pk && <Key size={10} x={6} y={7} className="text-yellow-500" />}
                      {col.fk && <Link size={10} x={col.pk ? 20 : 6} y={7} className="text-green-500" />}
                      {/* Column name */}
                      <text
                        x={col.pk || col.fk ? 32 : 10}
                        y={16}
                        fontSize={11}
                        fill="#334155"
                        fontWeight={col.pk ? 'bold' : 'normal'}
                      >
                        {col.name}
                      </text>
                      {/* Type */}
                      <text x={TABLE_WIDTH - 10} y={16} fontSize={10} fill="#94a3b8" textAnchor="end">
                        {col.type}
                      </text>
                    </g>
                  ))}
                  {/* Border */}
                  <rect width={TABLE_WIDTH} height={getTableHeight(tbl)} fill="none" stroke="#cbd5e1" strokeWidth={1} rx={4} />
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
