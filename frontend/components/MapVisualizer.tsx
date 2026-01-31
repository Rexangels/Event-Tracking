
import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { IntelligenceEvent } from '../types';
import { MAP_COLORS, EVENT_ICONS, getClusterColor } from '../constants';

interface MapVisualizerProps {
  events: IntelligenceEvent[];
  onEventClick: (event: IntelligenceEvent) => void;
  selectedEventId?: string;
  selectedRegion: string | null;
  onRegionSelect: (region: string | null) => void;
}

interface Cluster {
  x: number;
  y: number;
  count: number;
  events: IntelligenceEvent[];
}

const MapVisualizer: React.FC<MapVisualizerProps> = ({
  events,
  onEventClick,
  selectedEventId,
  selectedRegion,
  onRegionSelect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined>>();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const projectionRef = useRef<d3.GeoProjection>();
  const currentZoomRef = useRef(1);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [zoomDisplay, setZoomDisplay] = useState(1); // Only for UI display

  // Cache for subregions to prevent flickering/re-fetching
  const subregionCache = useRef<Record<string, any>>({});
  const lastLoadedRegion = useRef<string | null>(null);

  const width = 1000;
  const height = 600;

  // Cluster threshold
  const CLUSTER_ZOOM_THRESHOLD = 4;
  const CLUSTER_RADIUS = 50;

  // Debounce ref
  const updateTimeoutRef = useRef<NodeJS.Timeout>(null);

  // Stable clustering function using Quadtree for high performance
  const computeClusters = useCallback((
    projectedEvents: Array<{ event: IntelligenceEvent; x: number; y: number }>,
    zoomLevel: number
  ) => {
    if (projectedEvents.length < 5) return null;

    const clusters: Cluster[] = [];
    const assigned = new Set<string>();
    const radius = CLUSTER_RADIUS / zoomLevel;

    // Build quadtree for fast spatial indexing O(N log N)
    const tree = d3.quadtree<{ event: IntelligenceEvent; x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(projectedEvents);

    projectedEvents.forEach((d) => {
      if (assigned.has(d.event.id)) return;

      const nearby: Array<{ event: IntelligenceEvent; x: number; y: number }> = [];

      // Fast spatial search in the quadtree
      tree.visit((node, x1, y1, x2, y2) => {
        if (!node.length) {
          do {
            const data = (node as any).data;
            if (data && !assigned.has(data.event.id)) {
              const dx = data.x - d.x;
              const dy = data.y - d.y;
              if (Math.sqrt(dx * dx + dy * dy) < radius) {
                nearby.push(data);
              }
            }
          } while ((node = (node as any).next));
        }
        return x1 > d.x + radius || x2 < d.x - radius || y1 > d.y + radius || y2 < d.y - radius;
      });

      if (nearby.length >= 2) {
        const cx = nearby.reduce((sum, e) => sum + e.x, 0) / nearby.length;
        const cy = nearby.reduce((sum, e) => sum + e.y, 0) / nearby.length;
        clusters.push({
          x: cx,
          y: cy,
          count: nearby.length,
          events: nearby.map(n => n.event)
        });
        nearby.forEach(n => assigned.add(n.event.id));
      }
    });

    return { clusters, unclustered: projectedEvents.filter(e => !assigned.has(e.event.id)) };
  }, []);

  // Update events layer (called on zoom and data change)
  const updateEventsLayer = useCallback((zoomLevel: number, transform?: d3.ZoomTransform, immediate = false) => {
    if (!gRef.current || !projectionRef.current) return;

    if (updateTimeoutRef.current && !immediate) {
      clearTimeout(updateTimeoutRef.current);
    }

    const render = () => {
      const eventsLayer = gRef.current!.select('.events-layer');
      eventsLayer.selectAll('*').remove();

      const projection = projectionRef.current!;
      const projectedEvents = events.map(event => {
        const [x, y] = projection([event.coords.lng, event.coords.lat])!;
        return { event, x, y };
      });

      // Pulse animation
      const pulse = (selection: d3.Selection<SVGCircleElement, any, SVGGElement, unknown>) => {
        selection
          .attr('r', 0)
          .attr('opacity', 0.8)
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .attr('r', 25)
          .attr('opacity', 0)
          .on('end', function () {
            d3.select(this).call(pulse as any);
          });
      };

      // Use the provided zoomLevel (k) for scaling to keep icons pinpoint
      const k = zoomLevel;

      // Render individual events
      const renderEvents = (eventData: typeof projectedEvents) => {
        const eventGroups = eventsLayer.selectAll('.event-group')
          .data(eventData, (d: any) => d.event.id)
          .enter()
          .append('g')
          .attr('class', 'event-group')
          .attr('transform', d => `translate(${d.x}, ${d.y})`)
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation();
            onEventClick(d.event);
          });

        // Animated pings
        eventGroups.append('circle')
          .attr('class', 'event-ping')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('fill', 'none')
          .attr('stroke', d => MAP_COLORS[d.event.severity])
          .attr('stroke-width', 1 / k)
          .call(pulse as any);

        // Icon markers
        eventGroups.append('g')
          .attr('class', 'event-marker')
          .attr('transform', `scale(${1.2 / k})`)
          .each(function (d) {
            const g = d3.select(this);
            const isSelected = d.event.id === selectedEventId;
            const color = MAP_COLORS[d.event.severity];
            const iconPath = EVENT_ICONS[d.event.type]?.path || EVENT_ICONS.HUMAN_REPORT.path;

            g.append('circle')
              .attr('r', isSelected ? 14 : 10)
              .attr('fill', color)
              .attr('stroke', '#fff')
              .attr('stroke-width', isSelected ? 2 : 1)
              .style('filter', `drop-shadow(0 0 4px ${color})`);

            g.append('path')
              .attr('d', iconPath)
              .attr('fill', '#fff')
              .attr('transform', 'translate(-12, -12) scale(1)')
              .style('pointer-events', 'none');
          });

        eventGroups.append('title')
          .text(d => `${d.event.title}\nSeverity: ${d.event.severity}\nType: ${d.event.type}`);
      };

      // Render clusters
      const renderClusters = (clusters: Cluster[]) => {
        const clusterGroups = eventsLayer.selectAll('.cluster-group')
          .data(clusters)
          .enter()
          .append('g')
          .attr('class', 'cluster-group')
          .attr('transform', d => `translate(${d.x}, ${d.y})`)
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation();
            if (zoomRef.current && svgRef.current) {
              d3.select(svgRef.current)
                .transition()
                .duration(750)
                .call(
                  zoomRef.current.transform as any,
                  d3.zoomIdentity.translate(width / 2, height / 2).scale(6).translate(-d.x, -d.y)
                );
            }
          });

        clusterGroups.append('circle')
          .attr('class', 'cluster-circle')
          .attr('r', d => (15 + Math.log(d.count) * 5) / k)
          .attr('fill', d => getClusterColor(d.count))
          .attr('stroke', '#fff')
          .attr('stroke-width', 2 / k)
          .attr('opacity', 0.9)
          .style('filter', d => `drop-shadow(0 0 8px ${getClusterColor(d.count)})`);

        clusterGroups.append('text')
          .attr('class', 'cluster-text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', '#fff')
          .attr('font-size', `${11 / k}px`)
          .attr('font-weight', 'bold')
          .text(d => {
            if (d.count >= 1000) return `${(d.count / 1000).toFixed(1)}k`;
            return d.count > 99 ? '99+' : d.count;
          });
      };

      const clusterResult = computeClusters(projectedEvents, zoomLevel);
      if (clusterResult) {
        renderClusters(clusterResult.clusters);
        renderEvents(clusterResult.unclustered);
      } else {
        renderEvents(projectedEvents);
      }
    };

    if (immediate) {
      render();
    } else {
      // Debounce heavily during zoom
      updateTimeoutRef.current = setTimeout(render, 300);
    }

  }, [events, selectedEventId, onEventClick, computeClusters]);

  // Initialize Map (Static Layers & Zoom) - Runs Once
  useEffect(() => {
    if (!svgRef.current || gRef.current) return; // Prevent double init

    const svg = d3.select(svgRef.current);
    const g = svg.append('g');
    gRef.current = g;

    // Layer Order
    const heatmapLayer = g.append('g').attr('class', 'heatmap-layer');
    const regionsLayer = g.append('g').attr('class', 'regions-layer');
    g.append('g').attr('class', 'events-layer');

    const projection = d3.geoMercator()
      .scale(160)
      .translate([width / 2, height / 1.4]);
    projectionRef.current = projection;

    const path = d3.geoPath().projection(projection);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        const k = event.transform.k;
        currentZoomRef.current = k;
        setZoomDisplay(k);

        // Update regions stroke - Lightweight updates only!
        g.selectAll('.region').attr('stroke-width', 0.5 / Math.sqrt(k));
        g.selectAll('.subregion').attr('stroke-width', 0.2 / k);

        // Update labels
        g.selectAll('.state-label')
          .attr('font-size', 6 / Math.sqrt(k))
          .attr('opacity', k > 8 ? 0 : 1);

        // Hide events layer during rapid zooming if needed, or just let it scale
        // For best performance, we delay the re-clustering
        updateEventsLayer(k, event.transform, false);
      })
      .on('end', (event) => {
        // Force immediate full quality render when zoom stops
        updateEventsLayer(event.transform.k, event.transform, true);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Load World Map
    d3.json('/world.geojson').then((data: any) => {
      regionsLayer.selectAll('.region')
        .data(data.features)
        .enter()
        .append('path')
        .attr('class', 'region')
        .attr('d', path as any)
        .attr('fill', '#0f172a')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('click', (event, d: any) => {
          event.stopPropagation();
          const name = d.properties.name;
          onRegionSelect(name === selectedRegion ? null : name);
        });

      // Graticule
      regionsLayer.append('path')
        .datum(d3.geoGraticule()())
        .attr('d', path as any)
        .attr('fill', 'none')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.1)
        .attr('opacity', 0.4);
    });

    // Background Click (World Reset)
    svg.on('click', (event) => {
      if (event.target.tagName === 'svg') {
        onRegionSelect(null);
        lastLoadedRegion.current = null;
        g.select('.subregions').remove();
        g.select('.subregion-labels').remove();
        svg.transition().duration(750).call(zoom.transform as any, d3.zoomIdentity);
      }
    });

  }, []); // Strictly empty dependency array

  // Update Events & Heatmap (Dynamic)
  useEffect(() => {
    if (!gRef.current || !projectionRef.current) return;

    // Update Events - Immediate on data change
    updateEventsLayer(currentZoomRef.current, undefined, true);

    // Update Heatmap (Recalculate on data OR significant zoom change)
    const heatmapLayer = gRef.current.select('.heatmap-layer');
    heatmapLayer.selectAll('*').remove();

    if (showHeatmap && events.length > 0) {
      const projection = projectionRef.current;
      const k = currentZoomRef.current;

      // 1. Intelligence Weighting: Duplicate points based on severity
      // This makes Critical hotspots appear "hotter"
      const weightedEvents: Array<{ x: number; y: number }> = [];
      events.forEach(e => {
        const [x, y] = projection([e.coords.lng, e.coords.lat])!;
        let weight = 1;
        if (e.severity === 'critical') weight = 5;
        else if (e.severity === 'high') weight = 3;
        else if (e.severity === 'medium') weight = 2;

        for (let i = 0; i < weight; i++) {
          weightedEvents.push({ x, y });
        }
      });

      // 2. Zoom-Responsive Bandwidth: Sharpen blobs when zooming in
      // Base bandwidth 30, narrows down as we zoom in
      const dynamicBandwidth = Math.max(5, 30 / Math.pow(k, 0.5));

      const density = d3.contourDensity<{ x: number; y: number }>()
        .x(d => d.x)
        .y(d => d.y)
        .size([width, height])
        .bandwidth(dynamicBandwidth)
        .thresholds(15); // More thresholds for smoother gradients

      const contours = density(weightedEvents);
      const colorScale = d3.scaleSequential(d3.interpolateInferno)
        .domain([0, d3.max(contours, c => c.value) || 1]);

      heatmapLayer.selectAll('.contour')
        .data(contours)
        .enter()
        .append('path')
        .attr('class', 'contour')
        .attr('d', d3.geoPath())
        .attr('fill', d => colorScale(d.value))
        .attr('opacity', 0.5);
    }
  }, [events, showHeatmap, zoomDisplay, updateEventsLayer]); // Added zoomDisplay to trigger re-calculation

  // Handle Region Selection / Subregions
  useEffect(() => {
    if (!gRef.current || !projectionRef.current) return;
    const g = gRef.current;
    const regionsLayer = g.select('.regions-layer');

    // Update World Region Styling
    regionsLayer.selectAll('.region')
      .attr('fill', (d: any) => d.properties.name === selectedRegion ? '#1e293b' : '#0f172a')
      .attr('stroke', (d: any) => d.properties.name === selectedRegion ? '#3b82f6' : '#1e293b');

    // Subregion Loading Logic
    const loadSubregions = (url: string, regionKey: string) => {
      const renderSub = (features: any[]) => {
        g.select('.subregions').remove();
        g.select('.subregion-labels').remove();

        const subG = regionsLayer.append('g').attr('class', 'subregions');
        const labelsG = regionsLayer.append('g').attr('class', 'subregion-labels');
        const path = d3.geoPath().projection(projectionRef.current!);
        const colorScale = d3.scaleOrdinal(d3.schemeTableau10 || d3.schemeCategory10);

        // Group LGAs by State
        const states = d3.groups(features, (d: any) => d.properties.NAME_1 || 'Unknown');

        // Render LGA Paths
        subG.selectAll('.subregion')
          .data(features)
          .enter()
          .append('path')
          .attr('class', 'subregion')
          .attr('d', path as any)
          .attr('fill', (d: any) => {
            const stateName = d.properties.NAME_1 || d.properties.name || d.id;
            const baseColor = d3.color(colorScale(stateName));
            if (!baseColor) return colorScale(stateName);

            // Deterministic variation based on LGA name
            const lgaName = d.properties.NAME_2 || '';
            let hash = 0;
            for (let i = 0; i < lgaName.length; i++) hash = lgaName.charCodeAt(i) + ((hash << 5) - hash);
            const shift = (hash % 20) - 10; // -10 to +10 range
            return baseColor.brighter(shift / 10).toString();
          })
          .attr('stroke', '#1e293b')
          .attr('stroke-width', 0.2 / currentZoomRef.current)
          .attr('opacity', 0.9)
          .style('cursor', 'pointer')
          .on('mouseover', function (event, d: any) {
            d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 0.8 / currentZoomRef.current);
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.9).attr('stroke', '#1e293b').attr('stroke-width', 0.2 / currentZoomRef.current);
          })
          .on('click', (event, d: any) => {
            event.stopPropagation();
            if (!zoomRef.current || !svgRef.current) return;

            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const dx = x1 - x0;
            const dy = y1 - y0;
            const x = (x0 + x1) / 2;
            const y = (y0 + y1) / 2;
            const scale = Math.max(1, Math.min(20, 0.8 / Math.max(dx / width, dy / height)));
            const translate = [width / 2 - scale * x, height / 2 - scale * y];

            d3.select(svgRef.current)
              .transition()
              .duration(750)
              .call(
                zoomRef.current.transform as any,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
              );
          })
          .append('title').text((d: any) => `${d.properties.NAME_1}\nLGA: ${d.properties.NAME_2}`);

        // State Labels & Borders
        states.forEach(([stateName, lgas]: [string, any[]]) => {
          // Calculate State Centroid (approximate by averaging LGA centroids)
          let sx = 0, sy = 0, count = 0;
          lgas.forEach(lga => {
            const centroid = path.centroid(lga);
            if (!isNaN(centroid[0])) {
              sx += centroid[0];
              sy += centroid[1];
              count++;
            }
          });

          if (count > 0) {
            const cx = sx / count;
            const cy = sy / count;

            // State Label
            labelsG.append('text')
              .attr('class', 'state-label')
              .attr('x', cx)
              .attr('y', cy)
              .attr('text-anchor', 'middle')
              .attr('font-size', 6 / Math.sqrt(currentZoomRef.current))
              .attr('font-weight', 'bold')
              .attr('fill', '#fff')
              .attr('pointer-events', 'none')
              .style('text-shadow', '0 0 3px #000')
              .text(stateName);
          }
        });

        // LGA Names are handled via tooltips (title tag) to keep visualization clean
      };

      if (subregionCache.current[regionKey]) {
        renderSub(subregionCache.current[regionKey]);
      } else {
        d3.json(url).then((data: any) => {
          subregionCache.current[regionKey] = data.features;
          renderSub(data.features);
        });
      }
    };

    if (selectedRegion === 'USA' || selectedRegion === 'United States of America') {
      if (lastLoadedRegion.current !== 'USA') {
        loadSubregions('/us-states.json', 'USA');
        lastLoadedRegion.current = 'USA';
      }
    } else if (selectedRegion === 'Nigeria') {
      if (lastLoadedRegion.current !== 'Nigeria') {
        loadSubregions('/nigeria_optimized.json', 'Nigeria'); // Use optimized file
        lastLoadedRegion.current = 'Nigeria';
      }
    } else if (selectedRegion) {
      // Clear if a different non-null region is selected
      g.select('.subregions').remove();
      g.select('.subregion-labels').remove();
      lastLoadedRegion.current = null;
    }
    // If selectedRegion is null, we persist the last loaded layer (handling "cancel panel" use case)

  }, [selectedRegion]);

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
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded text-[10px] font-mono text-slate-400">
          ZOOM: {zoomDisplay.toFixed(1)}x | EVENTS: {events.length}
        </div>
      </div>

      {/* Control Buttons */}
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
        <div className="w-8 h-[1px] bg-slate-700 my-1"></div>
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`w-8 h-8 border rounded flex items-center justify-center transition-all shadow-lg ${showHeatmap
            ? 'bg-orange-500/90 border-orange-400 text-white'
            : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          title="Toggle Heatmap"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
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
        <div className="text-[8px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Severity</div>
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
