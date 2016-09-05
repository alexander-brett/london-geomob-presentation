
function fix(d){
  return typeof(d) === 'string'
    ? d == 'n/a'
      ? 0
      : +(d.replace(new RegExp(',', 'g'),'').replace('£','').replace('%', ''))
    : d;
}

var slideshow = remark.create({
  navigation: {
    scroll: false,
    touch: true,
    click: false
  }
});

var geographyPromise = loadUrl("wards_simplified.topojson", "json")
  .then(function(data){return topojson.feature(data, data.objects.wards).features});
var databasePromise = loadDatabase("data.db");

function colourFromPercentPromise(table, column){
  return databasePromise.then(function(db){
    var query = db.exec(
      "SELECT max("+column+"), min("+column+") FROM "+table+";"
      + "SELECT id, "+column+" FROM "+table+" ORDER BY id ASC;"
    );
    var min = query[0].values[0][1];
    var max = query[0].values[0][0];
    var data = {};
    query[1].values.forEach(function(value){data[value[0]] = value[1];});
    var convert = d3.scaleLinear().domain([fix(min),fix(max)]).range([230,20]);
    return function(d){
      var n = convert(fix(data[d.id]));
      return d3.rgb(0,n, n);
    }
  });
}

var projection = d3.geoMercator()
  .scale(35000)
  .center([-0.09, 51.48])
  .translate([400,320]);

var tapped = {};
var tapFunctions = {};
var loaded = {};

var slideFunctions = {
  "chloropleth-example-outline": function(){
    geographyPromise.then(function(geography){
      d3.select("#Uncoloured-Chloropleth")
      .selectAll("path")
      .data(geography)
      .enter().append("path")
      .attr("d", d3.geoPath().projection(projection))
      .attr("class", "wards-outline");
    });
  },
  "chloropleth-example-coloured": function(name){
    return geographyPromise.then(function(geography){
      var boroughs = {}, i = 0, palette = d3.scaleOrdinal(d3.schemeCategory20);
      return d3.select(name || "#Coloured-Chloropleth")
      .selectAll("path")
      .data(geography)
      .enter().append("path")
      .attr("d", d3.geoPath().projection(projection))
      .style("fill", function(d){
        if(boroughs[d.properties.BOROUGH] === undefined){ boroughs[d.properties.BOROUGH] = i++%20; }
        return palette(boroughs[d.properties.BOROUGH]);
      });
    });
  },
  "chloropleth-example-transition": function(){
    Promise.all([
      slideFunctions["chloropleth-example-coloured"]("#Transition-Chloropleth"),
      colourFromPercentPromise('housing', 'social*100.0/(social + owned + mortgage + private_rent + other)')
    ]).then(function(args){
      var [nodes, fn] = args;
      tapFunctions["chloropleth-example-transition"] = [function(){
        nodes.transition().duration(1500).style("fill", fn);
      }];
    });
  },
  "hexgrid-cells": function(name){
    var grid = new HexGrid(600, 630);
    d3.select(name||"#Hexgrid-cells").selectAll("polygon").data(grid.cells)
      .enter().append('polygon')
      .attr('points', '0,1 0.866,0.5 0.866,-0.5 0,-1 -0.866,-0.5 -0.866,0.5')
      .style('fill', 'rgba(0,0,0,0.2)').attr('transform', function(d){
        return 'translate('+d.x+','+d.y+') scale('+(grid.gridSpacing/Math.sqrt(3)-0.1)+')';
      });
    return grid;
  },
  "hexgrid-algorithm": function(name){
    var grid = new HexGrid(600, 630);
    d3.select("#Hexgrid-algorithm").selectAll("polygon").data(grid.cells)
      .enter().append('polygon')
      .attr('points', '0,1 0.866,0.5 0.866,-0.5 0,-1 -0.866,-0.5 -0.866,0.5')
      .style('fill', 'none').attr('transform', function(d){
        return 'translate('+d.x+','+d.y+') scale('+(grid.gridSpacing/Math.sqrt(3)-0.1)+')';
});
      var boroughs = {}, i = 0, palette = d3.scaleOrdinal(d3.schemeCategory20);

    databasePromise.then(function(db){
      var projection = d3.geoMercator()
        .scale(35000)
        .center([-0.09, 51.48])
        .translate([300,300]);
      var data = [];
      var statement = db.prepare(
        "SELECT * from boroughs " +
        "JOIN locations ON boroughs.id = locations.id " +
        "ORDER BY "+
        "(loCations.lat-($lat))*(locations.lat-($lat))"
        +"+(locations.long-($long))*(locations.long-($long))"
        +" ASC "
        , {$lat: 51.48, $long: -0.09}
      );
      while(statement.step()){
        var item = statement.getAsObject();
        [item.x,item.y] = projection([item.long, item.lat]);
        data.push(item);
      }
      return data;
    }).then(function(data){
      var dataIndex = 0;
      var nextPoint = d3.select("#Hexgrid-algorithm").append('circle');
      var iterate = function(){
        nextPoint.datum(data[dataIndex])
          .attr('cx', function(d){return d.x})
          .attr('cy', function(d){return d.y})
          .attr('r', 3)
          .style('fill', 'red');
        grid.occupyNearest(data[dataIndex]);
        d3.select("#Hexgrid-algorithm")
          .selectAll("polygon")
          .data(grid.boundaryCells(), function(d){return d.hexId})
          .style('fill', 'rgba(0,0,0,0.2)');
        d3.select("#Hexgrid-algorithm")
          .selectAll("polygon")
          .data([data[dataIndex]], function(d){return d.hexId})
          .style('fill', 'none')
          .style('stroke',  function(d){
            if(boroughs[d.borough] === undefined){ boroughs[d.borough] = i++%20; }
            return palette(boroughs[d.borough]);
          })
          .style('stroke-width', '0.3');
        d3.select("#Hexgrid-algorithm").append('line').datum(data[dataIndex])
          .attr('x1', function(d){return d.x;})
          .attr('y1', function(d){return d.y;})
          .attr('y2', function(d){return d.screenY;})
          .attr('x2', function(d){return d.screenX;})
          .style('stroke', 'black')
          .style('stroke-width', '1');

        dataIndex++;
        tapFunctions["hexgrid-algorithm"].push(iterate);
      };
      tapFunctions["hexgrid-algorithm"] = [];
      iterate();
    });
  }
}

slideshow.on('showSlide', function(slide){
  if (slideFunctions[slide.properties.name] && !loaded[slide.properties.name]++){
    slideFunctions[slide.properties.name]();
  }
});

slideshow.on('tappedSlide', function(){
  var slide = slideshow.getSlides()[slideshow.getCurrentSlideIndex()];
  if (tapped[slide.properties.name] === undefined) tapped[slide.properties.name] = 0;
  if (!!tapFunctions[slide.properties.name] && tapped[slide.properties.name] < tapFunctions[slide.properties.name].length){
    tapFunctions[slide.properties.name][tapped[slide.properties.name]++]();
  }
});
