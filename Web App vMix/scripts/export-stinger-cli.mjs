// Compatibilité avec l’ancien point d’entrée. Le pipeline V2 est média-first :
// il audite les masters fournis, sécurise uniquement leur alpha, puis produit
// les deux séquences PNG et les proxies WebM.
import "./prepare-stinger-v2.mjs";
