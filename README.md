# formulario-devs-arg

One-page Spanish (es-AR) site where Argentine Steam developers submit their game for the weekly releases
announcement of the **Comunidad Steam Argentina** (a community-run Steam group, not affiliated with Valve). The page
embeds a Google Form (responses go to a Google Sheet) and sends two Google Analytics 4 events.

- Live site: <https://freddre.github.io/formulario-devs-arg/>
- Hosting: GitHub Pages, served from the `docs/` folder of the `main` branch (the build output is committed).
- Stack: Vite 8, TypeScript (strict), Tailwind CSS v4 (utilities only), Vitest + jsdom.

## How it works

```
Steam announcement link (with UTM tags)
  -> GitHub Pages page (GA4 tag in <head>)
     -> Google Form in an iframe (docs.google.com/forms/.../viewform?embedded=true)
        -> Google Sheet (responses, ground truth)
```

| Event            | When                                                                 | Notes                                    |
| ---------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `page_view`      | page load (automatic)                                                | standard GA4                             |
| `form_visible`   | the form scrolls into view (once per page load)                      | `src/form-embed.ts`                      |
| `game_submitted` | the iframe navigates to the confirmation page after a submit         | `src/form-tracker.ts`, GA4 **key event** |

The embedded Google Form is a native HTML form, so submitting it navigates the iframe. Real iframe loads
alternate: 1st = form shown, 2nd = response sent, 3rd = form shown again ("Enviar otra respuesta"), and so on.
Ad blockers hide part of the GA4 traffic: the number of rows in the Sheet is the ground truth.

## Configuration

All public values live in [`site.config.json`](site.config.json). There are no secrets in this repository.

| Field                     | Meaning                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `siteUrl`                 | Public URL, with trailing slash (canonical and Open Graph tags).                        |
| `analytics.measurementId` | GA4 Measurement ID (`G-...`).                                                           |
| `form.viewUrl`            | Public form URL, `https://docs.google.com/forms/d/e/<id>/viewform` (no query string).   |
| `steamGroup.name` / `url` | Community name (header, footer, page title, share preview) and Steam group link.        |
| `contact.label` / `href`  | Contact shown in the privacy note and footer (https link, here the Discord invite).     |
| `cutoffText`              | Optional line under the header, for example the weekly deadline. Empty hides it.        |

`vite build` refuses placeholder values (`G-XXXXXXXXXX`, `FORM_ID`), so a broken page cannot be published.

## Commands

```powershell
npm install        # once
npm run typecheck  # tsc --noEmit
npm test           # vitest run (the post-build suite is skipped when docs/ does not exist)
npm run build      # production build into docs/
npm run verify     # typecheck + build + tests, including the post-build checks
npm run coverage   # tests with a v8 coverage report
npm run build:check  # build with placeholder values into .check-build/ (not committed)
```

Do not run a dev server for routine work: the unit tests and `npm run verify` cover the logic and the build.

## Publishing a change

```powershell
npm run verify
git add -A
git commit -m "Describe the change"
git push
```

GitHub Pages rebuilds in about a minute. Always commit `docs/` together with the source change.

## Weekly routine

1. Open the Google Sheet with the responses and review the new rows (check the Steam link and studio).
2. Write the announcement in Steam BBCode (template below) and post it in the group.
3. Use a tagged link so GA4 can attribute the visits:

   ```
   https://freddre.github.io/formulario-devs-arg/?utm_source=steam&utm_medium=grupo&utm_campaign=semana-2026-w41
   ```

   Change `semana-YYYY-wNN` to the ISO week of the announcement. Use `utm_source=discord` when the same
   announcement is also posted on the Discord.
4. Next day, compare `game_submitted` in GA4 with the new Sheet rows (the difference is the ad-blocker loss).

Steam BBCode template (only tags supported by Steam are used):

```
[h1]Lanzamientos argentinos de la semana[/h1]
[list]
[*][url=STEAM_URL][b]JUEGO[/b][/url] - ESTUDIO - sale el DD/MM
[*][url=STEAM_URL][b]JUEGO[/b][/url] - ESTUDIO - sale el DD/MM
[/list]
¿Desarrollás un juego en Steam desde Argentina? Cargalo acá: [url=TAGGED_LINK]formulario[/url]
```

## Reading the numbers in GA4

- Reports -> Acquisition -> Traffic acquisition: add the "Session campaign" dimension to see each announcement.
- Reports -> Engagement -> Events: `form_visible` and `game_submitted`.
- Realtime: quick check after a deploy.
- `game_submitted` must be marked as a key event (Admin -> Data display -> Key events). Marking is not retroactive.

## Form frame height

Google's embed does not tell the page how tall it is, so the iframe height is estimated from the viewport width:
`FRAME_HEIGHT_VIEW` for the form and `FRAME_HEIGHT_SUBMIT` for the confirmation page, both in `src/app.ts`. The
measured content heights are in `tests/form-height.test.ts`.

When you add or remove questions, or change long texts, re-measure: load the live page at several widths (320, 390,
640 and 1280 px at least), click "Enviar" on the empty form, force the iframe to 100 px tall and read
`document.scrollingElement.scrollHeight` inside it (with a taller frame that value is just the frame height).
The confirmation page needs a real test submission: send one with the game name "[PRUEBA] borrar", measure it the
same way, then delete the test row from the Sheet and the response from the form (Responses tab -> "Delete all
responses"). Update the measured tables and the expressions together: `npm test` fails when a frame is too short
or too tall for its table.

## Branding and share preview

- **Name**: always "Comunidad Steam Argentina", never "Steam Argentina" alone, and the footer states that the project
  is independent of Valve. `tests/page-content.test.ts` fails if either rule is broken, so the site cannot pass as an
  official Steam page.
- **No decorative marks**: the hero has no flag stripes and no emblem on purpose (both were tried and dropped as
  looking odd). `tests/page-content.test.ts` keeps the header free of graphics other than the arrow of the button.
  The Argentine identity comes from the celeste accent colour and the flag tile in `public/favicon.svg`.
- **Hero copy**: "Cargá el tuyo en este formulario..." starts on its own line (`<br />`). The hero does not repeat the
  eligibility or how long the form takes: they live in the requirements section and in the form itself.
- **Palette**: Tailwind's `celeste-*` tokens (the flag's light blue) are defined in `src/styles.css`; gold is
  `amber-400`. Tailwind's `sky-*` is only used for the hero gradient.
- **Share preview**: `public/og-image.png` (1200x630) is what Discord, WhatsApp or X show when the link is pasted.
  Edit `tools/og-image.svg`, open it in Chrome with a 1200x630 viewport and save a screenshot over the PNG. Keep its
  texts in sync with the `h1`. Chat apps cache previews: re-share with a new `?v=` query to see a change quickly.
- **Google Form**: it repeats the name in its description, in the "¿Cómo te enteraste?" option and in the
  confirmation message (Forms -> Settings -> Presentation; the Forms API cannot set that one, `ops/setup-form.gs`
  keeps the text). When texts change, re-measure the frame heights (see "Form frame height").

## Closing and reopening the form

Close the form from the Google Forms editor (Responses tab -> "Accepting responses" switch). With the Google
Workspace MCP the same is `set_publish_settings` (`is_published` true or false).

## Rollback

Close the form, then disable GitHub Pages (Settings -> Pages) or delete the repository, and delete the GA4 data stream.

## Project layout

```
site.config.json     public values (see Configuration)
index.html           es-AR markup; {{placeholders}} are filled at build time; inline SVG symbols (check, arrow)
vite.config.ts       base './', output to docs/, Tailwind and html-config plugins, Vitest config
public/              favicon.svg, og-image.png, .nojekyll (copied as they are to docs/)
tools/html-config.ts template renderer + Vite plugin that validates site.config.json
tools/og-image.svg   source of public/og-image.png (see Branding and share preview)
src/config.ts        types and validation of site.config.json, embed URL builder
src/styles.css       Tailwind entry + celeste palette tokens
src/analytics.ts     track(): GA4 event wrapper, no-op without gtag
src/form-tracker.ts  view/submit state machine over iframe loads
src/form-embed.ts    builds the iframe (src set before insertion) and the visibility observer
src/app.ts           wires the modules to the page
src/main.ts          entry point
tests/               one suite per module, page-content.test.ts for the rendered page, post-build checks
docs/                build output served by GitHub Pages (committed)
```

Privacy: the page publishes nothing by itself; the Google Form collects the data. The Sheet must stay private
(shared only with the group co-admins). The privacy note on the page states what is published and how to ask for
corrections.
