# Styles locaux de WebOS

Les styles utilitaires sont compilés et versionnés dans `utilities.css`. Le site ne charge plus le compilateur Tailwind depuis un CDN à chaque visite.

Après avoir ajouté des classes utilitaires dans le HTML ou le JavaScript :

```sh
npx --yes --package=tailwindcss@3.4.17 tailwindcss -c build/tailwind.config.cjs -i build/tailwind.input.css -o utilities.css --minify
```

Font Awesome Free 6.4.0 est hébergé dans `vendor/fontawesome/`, avec sa licence et ses fontes WOFF2. Les favicons les plus utilisées sont copiées dans `icons/` pour éviter une dépendance systématique à une requête Google pendant le rendu des boutons. Elles représentent uniquement les services correspondants, sans affiliation. La source utilisée pour chaque favicon est `https://www.google.com/s2/favicons?domain=DOMAINE&sz=128`.

Le nouveau fond Fluent est une image générée, optimisée en WebP. Les anciens fonds, habillages et clés de stockage sont conservés.
