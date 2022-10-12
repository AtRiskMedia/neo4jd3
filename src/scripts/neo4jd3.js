/* global d3, document */
/* jshint latedef:nofunc */
"use strict";

import * as d3 from "d3";

export default function Neo4jD3(selector, _options) {
  var container,
    graph,
    info,
    node,
    nodes,
    relationship,
    relationshipOutline,
    relationshipOverlay,
    relationshipText,
    relationships,
    selector,
    simulation,
    svg,
    svgNodes,
    svgRelationships,
    svgScale,
    svgTranslate,
    classes2colors = {},
    justLoaded = false,
    numClasses = 0,
    options = {
      arrowSize: 6,
      colors: colors(),
      neo4jData: undefined,
      neo4jDataUrl: undefined,
    },
    VERSION = "0.1.0";

  init(selector, _options);

  function version() {
    return VERSION;
  }

  function merge(target, source) {
    Object.keys(source).forEach(function (property) {
      target[property] = source[property];
    });
  }

  function colors() {
    // oneDark inspired by distrotube (dt)
    return [
      "#1c1f24", // black
      "#ff6c6b", // red
      "#98be65", // green
      "#da8548", // yellow
      "#51afef", // blue
      "#c678dd", // magenta
      "#5699af", // cyan
      "#a7b1b7", // white
      "#5b6268", // brighter black
      "#da8548", // brighter red
      "#4db5bd", // brighter green
      "#ecbe7b", // brighter yellow
      "#3071db", // brighter blue
      "#a9a1e1", // brighter magenta
      "#46d9ff", // brighter cyan
      "#dfdfdf", // brighter white
    ];
  }

  function color() {
    return options.colors[(options.colors.length * Math.random()) << 0];
  }

  function contains(array, id) {
    var filter = array.filter(function (elem) {
      return elem.id === id;
    });
    return filter.length > 0;
  }

  function size() {
    return {
      nodes: nodes.length,
      relationships: relationships.length,
    };
  }

  function neo4jDataToD3Data(data) {
    var graph = {
      nodes: [],
      relationships: [],
    };
    data.results.forEach(function (result) {
      result.data.forEach(function (data) {
        data.graph.nodes.forEach(function (node) {
          if (!contains(graph.nodes, node.id)) {
            graph.nodes.push(node);
          }
        });
        data.graph.relationships.forEach(function (relationship) {
          relationship.source = relationship.startNode;
          relationship.target = relationship.endNode;
          graph.relationships.push(relationship);
        });
        data.graph.relationships.sort(function (a, b) {
          if (a.source > b.source) {
            return 1;
          } else if (a.source < b.source) {
            return -1;
          } else {
            if (a.target > b.target) {
              return 1;
            }
            if (a.target < b.target) {
              return -1;
            } else {
              return 0;
            }
          }
        });
        for (var i = 0; i < data.graph.relationships.length; i++) {
          if (
            i !== 0 &&
            data.graph.relationships[i].source ===
              data.graph.relationships[i - 1].source &&
            data.graph.relationships[i].target ===
              data.graph.relationships[i - 1].target
          ) {
            data.graph.relationships[i].linknum =
              data.graph.relationships[i - 1].linknum + 1;
          } else {
            data.graph.relationships[i].linknum = 1;
          }
        }
      });
    });
    return graph;
  }

  function _types(links) {
    return Array.from(new Set(links.map((d) => d.type)));
  }

  function linkArc(d) {
    const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
    return `
    M${d.source.x},${d.source.y}
    A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
  `;
  }

  function drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  function randomD3Data(d, maxNodesToGenerate) {
    var data = {
        nodes: [],
        relationships: [],
      },
      i,
      label,
      node,
      numNodes = ((maxNodesToGenerate * Math.random()) << 0) + 1,
      relationship,
      s = size();
    for (i = 0; i < numNodes; i++) {
      label = "Testing";

      node = {
        id: s.nodes + 1 + i,
        labels: [label],
        properties: {
          random: label,
        },
        x: d.x,
        y: d.y,
      };
      data.nodes[data.nodes.length] = node;
      relationship = {
        id: s.relationships + 1 + i,
        type: label.toUpperCase(),
        startNode: d.id,
        endNode: s.nodes + 1 + i,
        properties: {
          from: Date.now(),
        },
        source: d.id,
        target: s.nodes + 1 + i,
        linknum: s.relationships + 1 + i,
      };
      data.relationships[data.relationships.length] = relationship;
    }
    return data;
  }

  function init(selector, _options) {
    merge(options, _options);
    if (options.hasOwnProperty("neo4jData")) {
      const data = neo4jDataToD3Data(options.neo4jData);
      const container = d3.select(selector);
      container.attr("class", "neo4jd3").html("");

      const links = data.relationships;
      const nodes = data.nodes;
      const types = _types(links);

      const svg = container
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("class", "neo4jd3-graph");
      svg
        .append("defs")
        .selectAll("marker")
        .data(types)
        .join("marker")
        .attr("id", (d) => `arrow-${d}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -0.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("fill", color)
        .attr("d", "M0,-5L10,0L0,5");

      const simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-400))
        .force(
          "link",
          d3.forceLink(links).id(function (d) {
            return d.id;
          })
        )
        .force(
          "center",
          d3.forceCenter(
            svg.node().parentElement.parentElement.clientWidth / 2,
            svg.node().parentElement.parentElement.clientHeight / 2
          )
        );

      const link = svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("stroke", (d) => color(d.type))
        .attr(
          "marker-end",
          (d) => `url(${new URL(`#arrow-${d.type}`, location)})`
        );

      const node = svg
        .append("g")
        .attr("fill", "currentColor")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .call(drag(simulation));
      node
        .append("circle")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .attr("r", 4);
      node
        .append("text")
        .attr("x", 8)
        .attr("y", "0.31em")
        .text((d) => d.id)
        .clone(true)
        .lower()
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 3);

      simulation.on("tick", function () {
        link.attr("d", linkArc);
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });
    }
  }

  return {
    neo4jDataToD3Data: neo4jDataToD3Data,
    randomD3Data: randomD3Data,
    size: size,
    version: version,
  };
}
