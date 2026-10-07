---
name: les-visual-review
description: "Recette visuelle des habillages web Lyon e-Sport : alignements, cadrage, transparence, animation et non-régression. À utiliser après une modification de composition ou de motion ; ne remplace pas une validation artistique ou un test dans vMix."
---

# Recette visuelle LES

Cette skill est un protocole de travail local, pas un moteur graphique ni un plugin officiel. Elle doit être appliquée aux seuls assets concernés par la demande courante.

## Avant la modification

Lire les AGENTS.md applicables, le DESIGN.md, le prompt courant et les modifications en cours. Identifier les assets autorisés et ceux à préserver. Une nouvelle demande explicite peut autoriser un changement ciblé précédemment gelé ; elle n'autorise pas une refonte générale. Garder une référence de l'état initial dans le même environnement de test.

## Vérifier les moyens réels

Repérer les commandes et URL du dépôt. Utiliser Playwright MCP, Chrome DevTools MCP ou l'automatisation de navigateur déjà disponible. Ne pas installer des outils concurrents sans raison. Ouvrir un profil de navigateur de test, pas les sessions personnelles. Ne pas désactiver les permissions de sécurité pour réussir un test.

## Construire et mesurer

Définir un canevas logique et une configuration commune de géométrie. Dériver les positions répétées ; ne pas les ajuster chacune au hasard. Distinguer géométrie visible, boîtes des fichiers, marges transparentes, traits et halos. Mesurer les éléments effectivement rendus après transformation, pas seulement les constantes censées les positionner.

Les valeurs et tolérances du prompt courant priment sur une ancienne configuration. Ne pas imposer à tous les futurs assets une grille propre à un écran particulier. Les logos sources restent intacts ; les reconstructions décoratives nécessitent une référence et une autorisation adaptées.

## Boucle de revue

1. Ouvrir la vraie page et attendre les ressources.
2. Capturer l'image et la consulter visuellement, pas seulement l'enregistrer.
3. Relever les écarts géométriques et les collisions dans le rendu.
4. Corriger uniquement les éléments autorisés.
5. Refaire les captures et les mesures.

Un snapshot d'accessibilité ne remplace pas l'inspection des pixels. Un build vert ne prouve ni alignement ni beauté. Utiliser si nécessaire un mode de guides isolé de la sortie de production, puis le retirer des livrables de diffusion.

## Animation et régression

Vérifier plusieurs phases intermédiaires et la lecture en temps réel. Figer les temps et le compteur uniquement dans les tests isolés. Les ancres de cadrage ne bougent pas si seul un effet de respiration lumineuse est demandé. Les aperçus ne doivent pas changer le programme.

Tester à taille native et à des échelles réduites ; convertir les mesures au repère logique. Consigner navigateur, dimensions, DPR et version des ressources. Comparer les références protégées dans le même environnement, sans les régénérer pour masquer un échec. Une comparaison des seules première et dernière images ne prouve pas le mouvement.

## Compte rendu honnête

Fournir commandes exécutées, fichiers modifiés, captures, mesures et résultats. Distinguer test de navigateur, validation artistique utilisateur et recette vMix. Si un accès navigateur ou une ressource manque, marquer explicitement ce qui n'a pas pu être validé. Ne pas annoncer de publication ou de test qui n'a pas eu lieu.
