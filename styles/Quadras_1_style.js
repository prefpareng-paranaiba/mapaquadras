var size = 0;
var placement = 'point';

var style_Quadras_1 = function(feature, resolution){
    var context = {
        feature: feature,
        variables: {}
    };
    
    var labelText = ""; 
    var value = feature.get("");
    var labelFont = "13.0px \'Arial\', sans-serif";
    var labelFill = "#f7ff01";
    var bufferColor = "#000000";
    var bufferWidth = 3.0;
    var textAlign = 'center';
    var offsetX = 0;
    var offsetY = 0;
    var overflow = false;
    var repeat = 0;
    var placement = 'point';
    if (feature.get("Quadra") !== null && resolution > 0 && resolution < 2) {
        labelText = String(feature.get("Quadra"));
    }
    var style = [ new ol.style.Style({
        stroke: new ol.style.Stroke({color: 'rgba(239,255,0,1.0)', lineDash: null, lineCap: 'square', lineJoin: 'bevel', width: 0.988}),
        text: createTextStyle(feature, resolution, labelText, labelFont,
                              labelFill, placement, bufferColor,
                              bufferWidth, textAlign, offsetX, offsetY, overflow, repeat)
    })];

    return style;
};
