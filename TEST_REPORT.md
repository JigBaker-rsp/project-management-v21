# Rapport de contrôle — V2.2

## Corrections demandées

| Point | Statut |
|---|---:|
| Supprimer le mode démo | OK |
| Supprimer la liste des fonctionnalités dans le dashboard | OK |
| Mettre un mur de login en point d'entrée | OK |
| Connexion Supabase obligatoire | OK |
| Ajouter un rôle admin distinct du PMO | OK |
| Conserver le pilotage/dashboard utile | OK |
| Garder planning visuel / Gantt | OK |
| Garder reporting consolidé | OK |

## Tests statiques

- `index.html` présent.
- `app.js` présent.
- `styles.css` présent.
- `database.sql` présent.
- `supabase-config.js` présent.
- Aucune action `demo` dans `app.js`.
- Aucun bouton `Seed démo` dans `index.html`.
- Rôle `admin` présent dans `app.js` et `database.sql`.
- `demoMode: false` dans les fichiers de configuration.

## Limites assumées

- L'application est GitHub Pages : pas de backend Node embarqué.
- L'administration avancée des utilisateurs reste pilotée par Supabase Auth ; l'app lit les profils et rôles, mais ne crée pas les comptes Auth directement depuis le front.
