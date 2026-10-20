# Page web de suppression de compte (exigence Google Play 2024)

À publier à l'adresse **`https://yako.ci/supprimer-compte`** (HTML/CSS statique, aucun script tiers).

**Point important à expliquer** : Yako ne détient aucune donnée sur un serveur. La suppression réelle se fait **dans l'application** (efface base, clés et enregistrements). La page explique la procédure et offre un contact pour les cas où l'utilisateur n'a plus accès à l'app (ex. téléphone perdu : les données, chiffrées et liées à l'appareil, sont inaccessibles ; une réinitialisation d'usine les détruit).

Délai de réponse à toute demande : **30 jours maximum**.

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supprimer mon compte Yako</title>
  <style>
    :root { --green:#0B6E4F; --bg:#FAFAF7; --text:#1d1d1b; }
    body { margin:0; font:18px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--text); }
    main { max-width:640px; margin:0 auto; padding:24px 16px; }
    h1 { color:var(--green); }
    ol li { margin-bottom:8px; }
    .card { background:#fff; border-radius:12px; padding:16px; box-shadow:0 1px 4px rgba(0,0,0,.08); margin:24px 0; }
    label { display:block; margin-top:12px; font-weight:600; }
    input { width:100%; box-sizing:border-box; font-size:18px; padding:10px; border:1px solid #ccc; border-radius:8px; }
    button, .btn { display:inline-block; margin-top:16px; background:var(--green); color:#fff; border:0; border-radius:8px; padding:12px 20px; font-size:18px; text-decoration:none; }
    small { color:#555; }
  </style>
</head>
<body>
<main>
  <h1>Supprimer mon compte Yako</h1>
  <p>Vos ventes, dépenses et enregistrements sont stockés <strong>uniquement sur votre téléphone</strong>, chiffrés. Yako n'a aucune copie sur un serveur.</p>

  <div class="card">
    <h2>Dans l'application (immédiat)</h2>
    <ol>
      <li>Ouvrez Yako et déverrouillez-le.</li>
      <li>Menu ⋮ → <strong>Réglages</strong> → <strong>Mes données</strong>.</li>
      <li><strong>Supprimer toutes mes données</strong>, tapez votre code secret, confirmez deux fois.</li>
    </ol>
    <p>Tout est effacé : base de données, clés de chiffrement, enregistrements vocaux, réglages.</p>
  </div>

  <div class="card">
    <h2>Vous n'avez plus accès à l'application ?</h2>
    <p>Désinstaller Yako efface toutes ses données de l'appareil. Si le téléphone est perdu, vos données restent chiffrées et illisibles sans votre code.</p>
    <p>Pour toute question ou demande liée à vos données (y compris d'éventuels partages consentis), écrivez-nous. Réponse sous <strong>30 jours maximum</strong>.</p>
    <!-- Formulaire volontairement sans envoi automatique (stub) : il ouvre l'e-mail de l'utilisateur. -->
    <form action="mailto:support@yako.ci" method="post" enctype="text/plain">
      <label for="phone">Numéro de téléphone (+225)</label>
      <input id="phone" name="telephone" inputmode="tel" pattern="(\+225)?\s?(01|05|07|27)[0-9\s]{8,12}" placeholder="+225 07 00 00 00 00" required>
      <label for="message">Votre demande</label>
      <input id="message" name="demande" value="Je souhaite la suppression de mes données Yako.">
      <button type="submit">Envoyer la demande</button>
    </form>
    <p><small>Ou écrivez directement à <a href="mailto:support@yako.ci?subject=Suppression%20de%20compte">support@yako.ci</a>.</small></p>
  </div>

  <p><small>Yako — loi ivoirienne n°2013-450 · Politique de confidentialité : <a href="/confidentialite">yako.ci/confidentialite</a></small></p>
</main>
</body>
</html>
```
