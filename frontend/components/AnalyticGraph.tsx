
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface AnalyticGraphProps {
    data: any[];
    type: 'bar' | 'line' | 'network' | 'table';
    title: string;
}

const AnalyticGraph: React.FC<AnalyticGraphProps> = ({ data, type, title }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !data || data.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        const margin = { top: 40, right: 20, bottom: 60, left: 60 };

        if (type === 'bar') {
            const x = d3.scaleBand()
                .domain(data.map((d, i) => d.label || d.name || d.id || `Item ${i}`))
                .range([margin.left, width - margin.right])
                .padding(0.3);

            const maxValue = d3.max(data, d => d.value || 0) as number;
            const y = d3.scaleLinear()
                .domain([0, maxValue > 0 ? maxValue : 10])
                .nice()
                .range([height - margin.bottom, margin.top]);

            svg.append('g')
                .attr('transform', `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(x))
                .selectAll('text')
                .attr('transform', 'rotate(-30)')
                .style('text-anchor', 'end')
                .attr('fill', '#94a3b8')
                .style('font-size', '10px');

            svg.append('g')
                .attr('transform', `translate(${margin.left},0)`)
                .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
                .selectAll('text')
                .attr('fill', '#94a3b8')
                .style('font-size', '10px');

            // Custom Color Palette
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
            const colorScale = d3.scaleOrdinal(colors);

            svg.selectAll('.bar')
                .data(data)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('x', (d, i) => x(d.label || d.name || d.id || `Item ${i}`) as number)
                .attr('y', d => y(d.value || 0))
                .attr('width', x.bandwidth())
                .attr('height', d => Math.max(0, height - margin.bottom - y(d.value || 0)))
                .attr('fill', (d, i) => colorScale(i.toString()))
                .attr('rx', 4);

        } else if (type === 'line') {
            const x = d3.scaleTime()
                .domain(d3.extent(data, d => new Date(d.date || d.timestamp)) as [Date, Date])
                .range([margin.left, width - margin.right]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value || 0) as number])
                .nice()
                .range([height - margin.bottom, margin.top]);

            svg.append('g')
                .attr('transform', `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(x))
                .attr('color', '#475569');

            svg.append('g')
                .attr('transform', `translate(${margin.left},0)`)
                .call(d3.axisLeft(y))
                .attr('color', '#475569');

            const line = d3.line<any>()
                .x(d => x(new Date(d.date || d.timestamp)))
                .y(d => y(d.value || 0))
                .curve(d3.curveMonotoneX);

            svg.append('path')
                .datum(data)
                .attr('fill', 'none')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 3)
                .attr('d', line);

            svg.selectAll('.dot')
                .data(data)
                .enter()
                .append('circle')
                .attr('cx', d => x(new Date(d.date || d.timestamp)))
                .attr('cy', d => y(d.value || 0))
                .attr('r', 4)
                .attr('fill', '#3b82f6')
                .attr('stroke', '#0f172a')
                .attr('stroke-width', 2);
        } else if (type === 'network') {
            // Basic Force Layout for Correlation
            const nodes = data.map((d, i) => ({ id: d.id, label: d.label, group: d.group || 1 }));
            const links = data.flatMap(d => (d.connections || []).map((target: string) => ({ source: d.id, target })));

            const simulation = d3.forceSimulation(nodes as any)
                .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
                .force('charge', d3.forceManyBody().strength(-300))
                .force('center', d3.forceCenter(width / 2, height / 2));

            const link = svg.append('g')
                .selectAll('line')
                .data(links)
                .enter()
                .append('line')
                .attr('stroke', '#334155')
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', 1);

            const node = svg.append('g')
                .selectAll('circle')
                .data(nodes)
                .enter()
                .append('circle')
                .attr('r', 8)
                .attr('fill', (d: any) => d.group === 'critical' ? '#ef4444' : '#3b82f6')
                .attr('stroke', '#0f172a')
                .attr('stroke-width', 2);

            node.append('title').text(d => d.label || d.id);

            simulation.on('tick', () => {
                link
                    .attr('x1', (d: any) => d.source.x)
                    .attr('y1', (d: any) => d.source.y)
                    .attr('x2', (d: any) => d.target.x)
                    .attr('y2', (d: any) => d.target.y);

                node
                    .attr('cx', (d: any) => d.x)
                    .attr('cy', (d: any) => d.y);
            });
        }

        // Add Title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('fill', '#f1f5f9')
            .style('font-weight', 'bold')
            .style('font-size', '14px')
            .text(title);

    }, [data, type, title]);

    if (type === 'table') {
        return (
            <div className="w-full bg-slate-900/50 rounded-xl border border-slate-800 p-4 mt-4 relative overflow-hidden group">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-200">{title}</h3>
                    <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-mono">
                        TABLE
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs text-left text-slate-400">
                        <thead className="text-xs text-slate-300 uppercase bg-slate-800/50">
                            <tr>
                                {data.length > 0 && Object.keys(data[0]).map((key) => (
                                    <th key={key} className="px-4 py-3">{key.replace(/_/g, ' ')}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                                    {Object.values(row).map((val: any, j) => (
                                        <td key={j} className="px-4 py-3">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-80 bg-slate-900/50 rounded-xl border border-slate-800 p-4 mt-4 relative overflow-hidden group">
            <div className="absolute top-4 right-4 flex gap-2">
                <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-mono">
                    {type.toUpperCase()}
                </div>
            </div>
            <svg ref={svgRef} className="w-full h-full" />
        </div>
    );
};

export default AnalyticGraph;
