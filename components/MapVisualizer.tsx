
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { IntelligenceEvent } from '../types';
import { MAP_COLORS } from '../constants';

interface MapVisualizerProps {
  events: IntelligenceEvent[];
  onEventClick: (event: IntelligenceEvent) => void;
  selectedEventId?: string;
  selectedRegion: string | null;
  onRegionSelect: (region: string | null) => void;
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({ 
  events, 
  onEventClick, 
  selectedEventId, 
  selectedRegion, 
  onRegionSelect 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<any>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 1000;
    const height = 600;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Tactical World Projection
    const projection = d3.geoMercator()
      .scale(160)
      .translate([width / 2, height / 1.4]);

    const path = d3.geoPath().projection(projection);

    // Zoom Management
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Adjust marker and ping sizes based on zoom level to maintain visibility
        const k = event.transform.k;
        g.selectAll('.event-marker').attr('r', 4 / Math.sqrt(k));
        g.selectAll('.event-ping').attr('stroke-width', 1 / k);
        g.selectAll('.region').attr('stroke-width', (d: any) => 
          (d.properties.name === selectedRegion ? 1.5 : 0.5) / Math.sqrt(k)
        );
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Load world data
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson').then((data: any) => {
      
      // Draw Regions (Countries)
      const regionPaths = g.selectAll('.region')
        .data(data.features)
        .enter()
        .append('path')
        .attr('class', 'region')
        .attr('d', path as any)
        .attr('fill', (d: any) => d.properties.name === selectedRegion ? '#1e293b' : '#0f172a')
        .attr('stroke', (d: any) => d.properties.name === selectedRegion ? '#3b82f6' : '#1e293b')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .style('transition', 'fill 0.2s ease')
        .on('click', function(event, d: any) {
          event.stopPropagation();
          const name = d.properties.name;
          const isDeselect = name === selectedRegion;
          onRegionSelect(isDeselect ? null : name);

          if (!isDeselect) {
            // Zoom to region bounding box
            const [[x0, y0], [x1, y1]] = path.bounds(d);
            svg.transition().duration(750).call(
              zoom.transform as any,
              d3.zoomIdentity
                .translate(width / 2, height / 2)
                .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
                .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
            );
          }
        })
        .on('mouseover', function(event, d: any) {
          if (d.properties.name !== selectedRegion) {
            d3.select(this).attr('fill', '#1e293b').attr('stroke', '#334155');
          }
        })
        .on('mouseout', function(event, d: any) {
          if (d.properties.name !== selectedRegion) {
            d3.select(this).attr('fill', '#0f172a').attr('stroke', '#1e293b');
          }
        });

      // Grid Lines (Graticule)
      const graticule = d3.geoGraticule();
      g.append('path')
        .datum(graticule())
        .attr('d', path as any)
        .attr('fill', 'none')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.1)
        .attr('opacity', 0.4);

      // Recursive Pulse Function
      const pulse = (selection: d3.Selection<SVGCircleElement, IntelligenceEvent, SVGGElement, unknown>) => {
        selection
          .attr('r', 0)
          .attr('opacity', 0.8)
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .attr('r', 25)
          .attr('opacity', 0)
          .on('end', function() {
            d3.select(this).call(pulse as any);
          });
      };

      // Draw Events
      const eventGroups = g.selectAll('.event-group')
        .data(events)
        .enter()
        .append('g')
        .attr('class', 'event-group')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation();
          onEventClick(d);
          
          // Center on event
          const [cx, cy] = projection([d.coords.lng, d.coords.lat])!;
          svg.transition().duration(750).call(
            zoom.transform as any,
            d3.zoomIdentity.translate(width / 2, height / 2).scale(12).translate(-cx, -cy)
          );
        });

      // Animated Pings
      eventGroups.append('circle')
        .attr('class', 'event-ping')
        .attr('cx', d => projection([d.coords.lng, d.coords.lat])![0])
        .attr('cy', d => projection([d.coords.lng, d.coords.lat])![1])
        .attr('fill', 'none')
        .attr('stroke', d => MAP_COLORS[d.severity])
        .attr('stroke-width', 1)
        .call(pulse as any);

      // Core Markers
      eventGroups.append('circle')
        .attr('class', 'event-marker')
        .attr('cx', d => projection([d.coords.lng, d.coords.lat])![0])
        .attr('cy', d => projection([d.coords.lng, d.coords.lat])![1])
        .attr('r', d => d.id === selectedEventId ? 6 : 4)
        .attr('fill', d => MAP_COLORS[d.severity])
        .attr('stroke', '#fff')
        .attr('stroke-width', d => d.id === selectedEventId ? 2 : 0.5)
        .append('title')
        .text(d => `${d.title}\nSeverity: ${d.severity}\nSource: ${d.source}`);
    });

    // Reset selection when clicking background
    svg.on('click', (event) => {
      if (event.target.tagName === 'svg') {
        onRegionSelect(null);
        svg.transition().duration(750).call(zoom.transform as any, d3.zoomIdentity);
      }
    });

  }, [events, selectedEventId, selectedRegion]);

  const handleManualZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    if (direction === 'reset') {
      svg.transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
      return;
    }
    const factor = direction === 'in' ? 1.5 : 1 / 1.5;
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden rounded-xl border border-slate-800 shadow-2xl group">
      {/* HUD Info */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded text-[10px] font-mono text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          GIS_CORE_LINK: ACTIVE
        </div>
        {selectedRegion && (
          <div className="bg-blue-600/90 backdrop-blur px-3 py-1.5 rounded text-[10px] font-bold text-white uppercase tracking-widest animate-in fade-in slide-in-from-left-2 shadow-lg border border-blue-400/30">
            SECTOR: {selectedRegion}
          </div>
        )}
      </div>

      {/* Manual Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
        <button 
          onClick={() => handleManualZoom('in')}
          className="w-8 h-8 bg-slate-900/90 border border-slate-700 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all shadow-lg"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </button>
        <button 
          onClick={() => handleManualZoom('out')}
          className="w-8 h-8 bg-slate-900/90 border border-slate-700 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all shadow-lg"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
        </button>
        <button 
          onClick={() => handleManualZoom('reset')}
          className="w-8 h-8 bg-slate-900/90 border border-slate-700 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white transition-all shadow-lg"
          title="Reset View"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      {/* Instructional Overlay */}
      <div className="absolute bottom-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 px-2 py-1 rounded border border-slate-800 text-[9px] text-slate-500 font-mono">
        MOUSE_WHEEL: ZOOM // DRAG: PAN // CLICK: SELECT
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 1000 600"
        className="w-full h-full touch-none select-none outline-none"
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        {Object.entries(MAP_COLORS).reverse().map(([severity, color]) => (
          <div key={severity} className="flex items-center gap-2 bg-slate-900/60 backdrop-blur px-2.5 py-1 rounded border border-slate-800/50">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-tighter">{severity}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapVisualizer;
