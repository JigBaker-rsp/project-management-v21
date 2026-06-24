# ProjectFlow Pro — V2.2 connectée

Application web statique déployable sur GitHub Pages, connectée à Supabase Auth + Postgres + RLS.

## Corrections majeures

- Point d'entrée = mur de connexion plein écran.
- Aucun mode démo.
- Aucune donnée locale utilisée comme stockage applicatif.
- Aucune documentation produit affichée dans le dashboard.
- Ajout d'un rôle `admin` distinct du rôle `pmo`.
- Le dashboard affiche uniquement du pilotage : KPI, portefeuille, alertes, décisions, jalons.

## Rôles

- `membre` : contribution aux tâches/actions de ses projets.
- `chef_projet` : pilotage projet, tâches, planning, risques, jalons.
- `gestionnaire_portfolio` : portefeuille, programmes, consolidation multi-projets.
- `directeur_programme` : arbitrages programme, gouvernance, décisions.
- `pmo` : méthode, reporting, gouvernance, consolidation.
- `admin` : utilisateurs, rôles, référentiels, audit, administration technique.

## Installation

1. Créer un projet Supabase.
2. Exécuter `database.sql` dans le SQL Editor Supabase.
3. Créer les utilisateurs dans Supabase Auth.
4. Affecter les rôles dans `public.profiles`.
5. Renseigner `supabase-config.js` :

```js
window.PROJECTFLOW_SUPABASE = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  demoMode: false
};
```

6. Déployer les fichiers à la racine d'un repo GitHub Pages.

## Fichiers

- `index.html` : structure de l'application.
- `styles.css` : design system.
- `app.js` : logique applicative.
- `database.sql` : schéma, rôles, RLS, trigger profile.
- `BACKLOG_USER_STORIES.md` : backlog produit.
- `TEST_REPORT.md` : rapport de contrôle.
