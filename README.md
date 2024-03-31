DiStraction
===========

## Sources

### Bibliothèques

### Modèles
Voiture :
* DS3 : http://archive3d.net/?a=download&id=a8b97687

Bâtiments :
* Tour Eiffel : http://www.references3d.com/fichier/tour-eiffel-mini/
* Arc de Triomphe : http://www.references3d.com/fichier/arc-triomphe/
* Sacré Coeur : http://www.references3d.com/fichier/basilique-du-sacre-coeur/
* Madeleine : http://www.references3d.com/fichier/madeleine/
* Notre Dame : http://www.references3d.com/fichier/notre-dame-paris/

## Code tips

### Ombres portées par les bâtiments sur eux-mêmes

L'effet est réalisé avec 2 méthodes combinées pour éviter les acnés :
* Dans ground.js on fait en sorte que les ombres soient générées par une copie des bâtiment réduite avec un coefficient de 0.98

> if (ground.shadowGenerator !== null) { ground._setShadowImpostor(meshWithShadowsList); }

> impostor = this._copyMesh(meshList[i], "copy", new BABYLON.Vector3(0.98, 0.98, 0.98));

* Dans le shader "cellShading.fragment.fx" on utilise l'effet Poisson avec un bias de 0.00002

De plus, dans le shader "cellShading.fragment.fx" on évite les ombres portées sur les surfaces qui sont dos à la lumière grâce au test du produit scalaire:
> if(dp > 0.0) gl_FragColor *= shadow;


## Blender

Consignes pour que le surlignage du cel-shading passe avec les bâtiments :

* Le centre de gravité doit se trouver à l'intérieur du volume (ne pas déplacer les faces originales au delà du centre de gravité)
Le plus simple est de faire "set origin" puis "origin to center of mass"
* Pour les formes qui ne sont pas des parallélépipèdes rectangles les coefficients de "scale" doivent être identiques sur x, y et z (sinon les normales sont fausses pour une raison inconnue et les faces arrières ne sont pas affichées au bon moment)
