var _ = _ || require("underscore");
var $ = $ || require("jquery");
var kdTree = kdTree || require('./lib/kdtree/src/node/kdTree.js').kdTree;

var GM = GM || {};

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
    return new GM.System(ways);
}

GM.System = function(ways) {
    this.lines = ways;
};
