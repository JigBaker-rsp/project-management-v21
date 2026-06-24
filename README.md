# ProjectFlow Pro V2.1

Application web statique déployable sur **GitHub Pages** avec backend **Supabase Auth + Postgres + RLS**.

## Ce que corrige cette version

- Connexion réelle via Supabase Auth.
- Rôles : membre, chef de projet, gestionnaire de portfolio, directeur de programme, PMO.
- Conservation du socle V1 : projets, tâches, statuts, priorités, sauvegarde, import/export, pilotage simple.
- Ajout d'une vraie couche pilotage : portfolio, programme, dashboards, RAG, budget, risques, décisions, actions, charge, reporting.
- Planning visuel : Gantt MVP, jalons, chemin critique simplifié, baseline.
- Backlog de user stories inclus.
- SQL Supabase complet avec RLS.

## Déploiement GitHub Pages

1. Dézipper l'archive.
2. Copier le contenu du dossier dans un repository GitHub.
3. Activer GitHub Pages sur la branche `main`, dossier `/root`.
4. L'application s'ouvre en mode démo/offline si Supabase n'est pas configuré.

## Connexion Supabase

1. Créer un projet Supabase.
2. Aller dans **SQL Editor** et exécuter `database.sql`.
3. Copier `supabase-config.example.js` vers `supabase-config.js`.
4. Renseigner :

```js
window.PROJECTFLOW_SUPABASE = {
  url: "https://xxx.supabase.co",
  anonKey: "xxx",
  demoMode: false
};
```

5. Créer des utilisateurs dans Supabase Auth.
6. Mettre à jour leur rôle dans la table `profiles`.

## Rôles

| Rôle | Usage |
|---|---|
| membre | saisie, avancement, commentaires, tâches affectées |
| chef_projet | gestion projet, tâches, planning, risques, jalons |
| gestionnaire_portfolio | portefeuille, arbitrage, consolidation |
| directeur_programme | programme, décisions, reporting exécutif |
| pmo | administration, référentiels, audit, tous droits |

## Fichiers

- `index.html` : shell applicatif.
- `styles.css` : design system.
- `app.js` : logique front, mode démo, Supabase, vues.
- `database.sql` : schéma Postgres + RLS.
- `BACKLOG_USER_STORIES.md` : backlog priorisé.
- `TEST_REPORT.md` : rapport de tests et critique.
- `supabase-config.example.js` : configuration modèle.

## Limites assumées

Cette version est une V2.1 statique avancée, pas encore une app SaaS industrialisée complète. Les prochaines étapes naturelles seraient : vraie édition inline complète, tests e2e Playwright, CI/CD, invitations utilisateurs, stockage fichiers Supabase Storage, et fonctions Edge pour notifications.
