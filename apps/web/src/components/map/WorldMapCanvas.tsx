import React, { useMemo, useState } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import landTopology from 'world-atlas/land-110m.json';
import type { MapLink, MapOverview, MapServiceNode } from '../../types';

const WIDTH = 960;
const HEIGHT = 480;

function projectFactory() {
  return geoEqualEarth()
    .translate([WIDTH / 2, HEIGHT / 2 + 20])
    .scale(155);
}

function statusColor(status: MapServiceNode['status']): string {
  if (status === 'up') return '#22c55e';
  if (status === 'down') return '#ef4444';
  return '#a1a1aa';
}

function arcPath(
  from: [number, number],
  to: [number, number]
): string {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2 - Math.min(80, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.25);
  return `M ${from[0]} ${from[1]} Q ${mx} ${my} ${to[0]} ${to[1]}`;
}

interface Props {
  data: MapOverview;
  selectedId: string | null;
  onSelect: (node: MapServiceNode | null) => void;
}

export const WorldMapCanvas: React.FC<Props> = ({ data, selectedId, onSelect }) => {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { landPath, projection } = useMemo(() => {
    const projection = projectFactory();
    const path = geoPath(projection);
    const land = feature(
      landTopology as unknown as Topology,
      (landTopology as unknown as Topology).objects.land as GeometryCollection
    );
    return { landPath: path(land) ?? '', projection };
  }, []);

  const nodePoints = useMemo(() => {
    return data.nodes.map((node) => {
      const xy = projection([node.longitude, node.latitude]);
      return { node, x: xy?.[0] ?? 0, y: xy?.[1] ?? 0 };
    });
  }, [data.nodes, projection]);

  const regionCenters = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const agg of data.regions) {
      const xy = projection([agg.region.longitude, agg.region.latitude]);
      if (xy) map.set(agg.region.code, xy as [number, number]);
    }
    return map;
  }, [data.regions, projection]);

  const links = useMemo(() => {
    return data.links
      .map((link: MapLink) => {
        const from = regionCenters.get(link.from_region);
        const to = regionCenters.get(link.to_region);
        if (!from || !to) return null;
        return { key: `${link.from_region}-${link.to_region}`, d: arcPath(from, to) };
      })
      .filter(Boolean) as Array<{ key: string; d: string }>;
  }, [data.links, regionCenters]);

  const hoverNode = nodePoints.find((p) => p.node.id === hoverId);

  return (
    <div className="world-map">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="world-map__svg"
        role="img"
        aria-label="Mapa mundial de monitores"
        onClick={() => onSelect(null)}
      >
        <defs>
          <radialGradient id="oceanGlow" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="rgba(99,102,241,0.18)" />
            <stop offset="55%" stopColor="rgba(15,15,19,0.4)" />
            <stop offset="100%" stopColor="rgba(9,9,11,0.9)" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#oceanGlow)" rx="16" />

        {/* Grid */}
        {Array.from({ length: 12 }).map((_, i) => {
          const x = ((i + 1) / 13) * WIDTH;
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={HEIGHT}
              stroke="rgba(255,255,255,0.035)"
              strokeWidth={1}
            />
          );
        })}
        {Array.from({ length: 6 }).map((_, i) => {
          const y = ((i + 1) / 7) * HEIGHT;
          return (
            <line
              key={`h-${i}`}
              x1={0}
              y1={y}
              x2={WIDTH}
              y2={y}
              stroke="rgba(255,255,255,0.035)"
              strokeWidth={1}
            />
          );
        })}

        <path
          d={landPath}
          fill="rgba(255,255,255,0.06)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.6}
        />

        {links.map((link) => (
          <path
            key={link.key}
            d={link.d}
            className="world-map__link"
            fill="none"
          />
        ))}

        {data.regions.map((agg) => {
          const xy = regionCenters.get(agg.region.code);
          if (!xy) return null;
          return (
            <g key={agg.region.code} className="world-map__region" transform={`translate(${xy[0]}, ${xy[1]})`}>
              <circle r={18} className="world-map__region-halo" />
              <text y={32} textAnchor="middle" className="world-map__region-label">
                {agg.region.city || agg.region.name}
              </text>
            </g>
          );
        })}

        {nodePoints.map(({ node, x, y }) => {
          const selected = selectedId === node.id;
          const color = statusColor(node.status);
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              className={`world-map__node ${selected ? 'is-selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node);
              }}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ cursor: 'pointer' }}
            >
              {node.heartbeat_alive && node.status === 'up' && (
                <>
                  <circle r={10} className="world-map__pulse" style={{ stroke: color }} />
                  <circle r={10} className="world-map__pulse world-map__pulse--delay" style={{ stroke: color }} />
                </>
              )}
              {node.status === 'down' && (
                <circle r={12} className="world-map__pulse world-map__pulse--down" style={{ stroke: color }} />
              )}
              <circle
                r={selected ? 7 : 5.5}
                fill={color}
                filter="url(#softGlow)"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1.2}
              />
            </g>
          );
        })}
      </svg>

      {hoverNode && (
        <div
          className="world-map__tooltip"
          style={{
            left: `${(hoverNode.x / WIDTH) * 100}%`,
            top: `${(hoverNode.y / HEIGHT) * 100}%`,
          }}
        >
          <strong>{hoverNode.node.name}</strong>
          <span>
            {hoverNode.node.status.toUpperCase()}
            {hoverNode.node.last_response_time_ms != null &&
              ` · ${hoverNode.node.last_response_time_ms} ms`}
          </span>
        </div>
      )}
    </div>
  );
};
