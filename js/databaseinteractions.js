// Explanatory notes for this file.

// I could have just downloaded the .csv file from data.london.gov.uk and been
// happy, but ultimately I was putting this on my website, and so I was concerned
// about speed and data usage - and CSV is not the most efficient way to do things.

// Additionally, putting the data I cared about in a sqlite database made coping
// with datasets that spanned multiple years much easier, especially since
// querying things with sql.js is very easy indeed.

var databasePromise = loadDatabase("data.db");

function colourFromPercentPromise(table, column){
  return databasePromise.then(function(db){
    var query = db.exec("SELECT max("+column+"), min("+column+") FROM "+table+";");
    var [max, min] = query[0].values[0];
    var data = sqlQuery(db, "SELECT id, "+column+" FROM "+table+";");
    var convert = d3.scaleLinear().domain([fix(min),fix(max)]).range([255,0]);
    return function(d, colourpicker){
      var n = convert(fix(data[d.id]));
      return typeof(colourpicker) === "function" ? colourpicker(n) : d3.rgb(0,n, n);
    }
  });
}

function radiusByAxisPromise(column, table){
  return databasePromise.then(function(db){
    var query = db.exec("SELECT max("+column+"), min("+column+") FROM "+table+";");
    var [max, min] = query[0].values[0];
    var data = sqlQuery(db, "SELECT id, "+column+" FROM "+table+" ORDER BY id ASC;");
    var convert = d3.scaleSqrt().domain([0,fix(max)]).range([0,24]);
    return function(i){
      return convert(fix(data[i.id]))
    };
  });
}

var radiusByAreaPromise = radiusByAxisPromise("area", "area");

var colourByCouncilHousingPromise = colourFromPercentPromise('housing', 'social*100.0/(social + owned + mortgage + private_rent + other)');

var colourByMayorPromise = databasePromise.then(function(db){
  var data = sqlQuery(db, "SELECT id, winner FROM voting");
  var colours = {
    'Sadiq Aman Khan - Labour Party' : d3.rgb(250,15,15),
    'Zac Goldsmith - The Conservative Party': d3.rgb(15,15,250)
  };
  return function(d){
    return colours[data[d.id]];
  }
})

var boroughsPromise = databasePromise.then(function(db){
  var _projection = d3.geoMercator()
    .scale(37000)
    .center([-0.09, 51.5])
    .translate([300,300]);
  var data = [];
  var statement = db.prepare(
    "SELECT * from boroughs " +
    "JOIN locations ON boroughs.id = locations.id " +
    "ORDER BY "+
    "(loCations.lat-($lat))*(locations.lat-($lat))"
    +"+(locations.long-($long))*(locations.long-($long))"
    +" ASC "
    , {$lat: 51.5, $long: -0.09}
  );
  while(statement.step()){
    var item = statement.getAsObject();
    [item.initialX, item.initialY] = [item.x,item.y] = _projection([item.long, item.lat]);
    data.push(item);
  }
  return data;
});

var radiusByPopulationPromise = databasePromise.then(function(db){
  var table = "population", column = "population";
  var query = db.exec("SELECT max("+column+"), min("+column+") FROM "+table+" WHERE year=2016;");
  var [max, min] = query[0].values[0];
  var data = sqlQuery(db, "SELECT id, "+column+" FROM "+table+" WHERE year=2016 ORDER BY id ASC;");
  var convert = d3.scaleSqrt().domain([0,fix(max)]).range([0,10]);
  return function(i){
    return convert(fix(data[i.id]))
  };
});
