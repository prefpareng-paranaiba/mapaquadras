var wms_layers = [];


        var lyr_GoogleHybrid_0 = new ol.layer.Tile({
            'title': 'Google Hybrid',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: '<a href="https://www.google.at/permissions/geoguidelines/attr-guide.html">Map data ©2015 Google</a>',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });
var format_Quadras_1 = new ol.format.GeoJSON();
var features_Quadras_1 = format_Quadras_1.readFeatures(json_Quadras_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Quadras_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Quadras_1.addFeatures(features_Quadras_1);
var lyr_Quadras_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Quadras_1, 
                style: style_Quadras_1,
                popuplayertitle: 'Quadras',
                interactive: true,
                title: '<img src="styles/legend/Quadras_1.png" /> Quadras'
            });
var format_Santa_Monica_Lotes_2 = new ol.format.GeoJSON();
var features_Santa_Monica_Lotes_2 = format_Santa_Monica_Lotes_2.readFeatures(json_Santa_Monica_Lotes_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Santa_Monica_Lotes_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Santa_Monica_Lotes_2.addFeatures(features_Santa_Monica_Lotes_2);
var lyr_Santa_Monica_Lotes_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Santa_Monica_Lotes_2, 
                style: style_Santa_Monica_Lotes_2,
                popuplayertitle: 'Santa_Monica_Lotes',
                interactive: true,
                title: '<img src="styles/legend/Santa_Monica_Lotes_2.png" /> Santa_Monica_Lotes'
            });
var format_Santa_Monica_AConstruida_3 = new ol.format.GeoJSON();
var features_Santa_Monica_AConstruida_3 = format_Santa_Monica_AConstruida_3.readFeatures(json_Santa_Monica_AConstruida_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Santa_Monica_AConstruida_3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Santa_Monica_AConstruida_3.addFeatures(features_Santa_Monica_AConstruida_3);
var lyr_Santa_Monica_AConstruida_3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Santa_Monica_AConstruida_3, 
                style: style_Santa_Monica_AConstruida_3,
                popuplayertitle: 'Santa_Monica_A.Construida',
                interactive: true,
                title: '<img src="styles/legend/Santa_Monica_AConstruida_3.png" /> Santa_Monica_A.Construida'
            });
var group_Publico = new ol.layer.Group({
                                layers: [lyr_Santa_Monica_Lotes_2,lyr_Santa_Monica_AConstruida_3,],
                                fold: 'open',
                                title: 'Publico'});
var group_Divisoesmapa = new ol.layer.Group({
                                layers: [],
                                fold: 'close',
                                title: 'Divisoes mapa'});

lyr_GoogleHybrid_0.setVisible(true);lyr_Quadras_1.setVisible(true);lyr_Santa_Monica_Lotes_2.setVisible(true);lyr_Santa_Monica_AConstruida_3.setVisible(true);
var layersList = [lyr_GoogleHybrid_0,lyr_Quadras_1,group_Publico];
lyr_Quadras_1.set('fieldAliases', {'fid': 'fid', 'Quadra': 'Quadra', 'Bairro': 'Bairro', 'Link pdf': 'Link pdf', 'MAPA PDF': 'MAPA PDF', 'Link_exter': 'Link_exter', });
lyr_Santa_Monica_Lotes_2.set('fieldAliases', {'fid': 'fid', 'Lote': 'Lote', 'Quadra': 'Quadra', 'Cadastro': 'Cadastro', 'Area_Constr_Total': 'Area_Constr_Total', 'Area_Terreno': 'Area_Terreno', 'Cadastro_Matrícula': 'Cadastro_Matrícula', 'Cadastro_Setor': 'Cadastro_Setor', 'Cadastro_Área Terr.': 'Cadastro_Área Terr.', 'Cadastro_Área Edif.': 'Cadastro_Área Edif.', });
lyr_Santa_Monica_AConstruida_3.set('fieldAliases', {'fid': 'fid', 'Desc_nivel': 'Desc_nivel', 'Elevação': 'Elevação', 'Cadastro_lote': 'Cadastro_lote', 'Área_T': 'Área_T', });
lyr_Quadras_1.set('fieldImages', {'fid': 'TextEdit', 'Quadra': 'TextEdit', 'Bairro': 'TextEdit', 'Link pdf': 'TextEdit', 'MAPA PDF': 'TextEdit', 'Link_exter': 'TextEdit', });
lyr_Santa_Monica_Lotes_2.set('fieldImages', {'fid': 'TextEdit', 'Lote': 'TextEdit', 'Quadra': 'TextEdit', 'Cadastro': 'Range', 'Area_Constr_Total': 'TextEdit', 'Area_Terreno': 'TextEdit', 'Cadastro_Matrícula': 'TextEdit', 'Cadastro_Setor': 'Range', 'Cadastro_Área Terr.': 'TextEdit', 'Cadastro_Área Edif.': 'TextEdit', });
lyr_Santa_Monica_AConstruida_3.set('fieldImages', {'fid': 'TextEdit', 'Desc_nivel': 'TextEdit', 'Elevação': 'TextEdit', 'Cadastro_lote': 'Range', 'Área_T': 'TextEdit', });
lyr_Quadras_1.set('fieldLabels', {'fid': 'hidden field', 'Quadra': 'inline label - visible with data', 'Bairro': 'inline label - visible with data', 'Link pdf': 'hidden field', 'MAPA PDF': 'hidden field', 'Link_exter': 'header label - visible with data', });
lyr_Santa_Monica_Lotes_2.set('fieldLabels', {'fid': 'hidden field', 'Lote': 'inline label - visible with data', 'Quadra': 'inline label - visible with data', 'Cadastro': 'inline label - visible with data', 'Area_Constr_Total': 'inline label - visible with data', 'Area_Terreno': 'inline label - visible with data', 'Cadastro_Matrícula': 'inline label - visible with data', 'Cadastro_Setor': 'inline label - visible with data', 'Cadastro_Área Terr.': 'inline label - visible with data', 'Cadastro_Área Edif.': 'inline label - visible with data', });
lyr_Santa_Monica_AConstruida_3.set('fieldLabels', {'fid': 'hidden field', 'Desc_nivel': 'hidden field', 'Elevação': 'hidden field', 'Cadastro_lote': 'inline label - visible with data', 'Área_T': 'inline label - visible with data', });
lyr_Santa_Monica_AConstruida_3.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});