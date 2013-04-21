var GM = GM || {};

/* A power line */
GM.PowerLine = function(way) {
    if(way.tags.power == 'line') {
        this.nodes = way.nodes;
        this.usr = way.usr;
        this.id = way.id;
        this.tags = way.tags;
    };
};

/* The string representation of this object. Used in the map popup. */
GM.PowerLine.prototype.toString = function() {
    return _.template('<%= tags.voltage %> <%= tags.ref %> line <br/>' +
                      'Operated by <%= tags.operator %>',
                      this);
};

/* The leaflet object representation of this power line */
GM.PowerLine.prototype.toLeafletObject = function() {
    var color = 'red';
    var toLeafletOptions = function(line) {
        var t = line.tags;
        if (t.operator === 'PLN' && t.ref === 'MV' && t.voltage === '20 kV') {
            return {color: 'red', opacity: 1};
        } else {
            return {color: 'grey', opacity: 1};
        }
    };

    var l = new L.Polyline(
        _.map(this.nodes, function(n) { return new L.LatLng(n.lat, n.lng); }),
        toLeafletOptions(this)
    );
    l.bindPopup(this.toString());
    return l;
};

/* KML output of a powerline. */
GM.PowerLine.prototype.toKML = function(style) {
    var template =
        '\n<Placemark>' +
        '\n  <name> <%= id %> </name>' +
        '\n  <description><![CDATA[' +
        '<% _.each(tags, function(v, k) { %><%= k %> = <%= v %> <br/> <% }) %>' +
        ']]></description>' +
        '\n  <LineString><coordinates>' +
        '<% _.each(nodes, function(nd) { %><%= nd.lng %>,<%= nd.lat %>,0.0 <% }) %>' +
        '\n  </coordinates></LineString>' +
        '\n  <styleUrl>' + style + '</styleUrl>'+
        '\n</Placemark>';
    return _.template(template, this);
};

/* A Grid Network -- its got some power lines */
GM.GridNetwork = function(ways) {
    this.lines = _(ways).chain()
                .filter(function (w) { return w.tags.power == 'line'; })
                .map(function(w) { return new GM.PowerLine(w); })
                .value();
};

/* The leaflet object representation of this grid network. */
GM.GridNetwork.prototype.toLeafletObject = function() {
    var lg = new L.LayerGroup();
    _.each(
    this.lines, function(line) {
        lg.addLayer(line.toLeafletObject());
    });
    return lg;
};

/* KML output of a whole grid network */
GM.GridNetwork.prototype.toKML = function() {
    var template =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '\n<Document>' +
        '<Style id="style0"><LineStyle><color>fe008526</color>' +
            '<width>2</width></LineStyle></Style>' +
        '\n<Folder>' +
        '<% _.each(lines, function(ln) { %> <%= ln.toKML("#style0") %> <% }) %>' +
        '\n</Folder></Document>';
    return _.template(template, this);
};

/* GLOBAL FUNCTION -- read the config_file located at config_path, load up the appropriate
 * data, and call callback after constructing the GridNetwork */
GM.fromConfig = function(config_path, cb) {
    $.getJSON(config_path, {}, function(conf) {
        // mix in conf options into GM
        GM = _.extend(conf, GM);
        // load in & parse XML
        $.ajax({type: conf.GET_OR_POST, url: conf.API_URL,
            data: conf.QUERY_STRING,
            dataType: "text",
            success: function(res) { cb(GM.fromOSM(res)); }
        });
    });
};

/* Construct a GridNetwork object from some OSM XML data */
GM.fromOSM = function (osmXML) {
    var nodes = {},
        ways = {},
        $osmXML = $(osmXML);
    var tagToObj = function(tag) {
        tags = {};
        _.each(tag, function (t) {
            var $t = $(t);
            tags[$t.attr('k')] = $t.attr('v'); });
        return tags;
    };
    /* Step 1: process all the returned nodes; put them in local nodes obj */
    _.each($osmXML.find('node'), function(n) {
        var $n = $(n);
        var tagObj = tagToObj($n.find('tag'));
        nodes[$n.attr('id')] = {id: $n.attr('id'),
                                lat: $n.attr('lat'),
                                lng: $n.attr('lon'),
                                usr: $n.attr('user'),
                                tag: tagObj,
        };
    });
    /* Step 2: put all ways from overpass into local ways obj */
    _.each($osmXML.find('way'), function(w) {
        var $w = $(w);
        var tagObj = tagToObj($w.find('tag'));
        var myNodes = _.map($w.find('nd'), function(n) {
            return nodes[$(n).attr('ref')];
        });
        ways[$w.attr('id')] = {id: $w.attr('id'),
                               usr: $w.attr('user'),
                               nodes: myNodes,
                               tags: tagObj
        };
    });
    /* Step 3, create a grid network out of constructed objects */
    return new GM.GridNetwork(ways);
}

