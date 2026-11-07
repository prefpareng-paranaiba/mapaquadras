var wms_layers = [];


        var lyr_GoogleHybrid_0 = new ol.layer.Tile({
            'title': 'Google Hybrid',
            'type':'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });
var format_QuadrasNOVOquadras_v515b_1 = new ol.format.GeoJSON();
var features_QuadrasNOVOquadras_v515b_1 = format_QuadrasNOVOquadras_v515b_1.readFeatures(json_QuadrasNOVOquadras_v515b_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_QuadrasNOVOquadras_v515b_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_QuadrasNOVOquadras_v515b_1.addFeatures(features_QuadrasNOVOquadras_v515b_1);
var lyr_QuadrasNOVOquadras_v515b_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_QuadrasNOVOquadras_v515b_1, 
                style: style_QuadrasNOVOquadras_v515b_1,
                popuplayertitle: 'Quadras NOVO — quadras_v515b',
                interactive: true,
                title: '<img src="styles/legend/QuadrasNOVOquadras_v515b_1.png" /> Quadras NOVO — quadras_v515b'
            });

lyr_GoogleHybrid_0.setVisible(true);lyr_QuadrasNOVOquadras_v515b_1.setVisible(true);
var layersList = [lyr_GoogleHybrid_0,lyr_QuadrasNOVOquadras_v515b_1];
lyr_QuadrasNOVOquadras_v515b_1.set('fieldAliases', {'fid': 'fid', 'Quadra': 'Quadra', 'Bairro': 'Bairro', 'Link pdf': 'Link pdf', 'MAPA PDF': 'MAPA PDF', 'Link_exter': 'Link_exter', });
lyr_QuadrasNOVOquadras_v515b_1.set('fieldImages', {'fid': 'TextEdit', 'Quadra': 'TextEdit', 'Bairro': 'TextEdit', 'Link pdf': 'TextEdit', 'MAPA PDF': 'TextEdit', 'Link_exter': 'TextEdit', });
lyr_QuadrasNOVOquadras_v515b_1.set('fieldLabels', {'fid': 'no label', 'Quadra': 'inline label - visible with data', 'Bairro': 'inline label - visible with data', 'Link pdf': 'no label', 'MAPA PDF': 'no label', 'Link_exter': 'no label', });
lyr_QuadrasNOVOquadras_v515b_1.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});