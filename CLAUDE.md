# Shoggoth Reviews

Next.js app for browsing GitHub repositories and pull requests.

- Dev server: `npm run dev` (port 2111)
- Typecheck: `npm run typecheck`
- Production: https://www.humanintheloop.review


## Desktop app

- `npm run desktop` opens the Electron app in dev mode on the git repository you run it
  from. Arguments after `--` work like `git diff` / `git show`: `npm run desktop -- show HEAD~1`.
- `npm link` puts `reposcope` on PATH. It runs the production build, so run `npm run build` first.
- `npm run check:local-git` exercises the local git layer against scratch repositories.

Local repository routes (`/local`, `/diff`, `/show`, `/launch`, `/api/local/*`) exist only when
`desktop/server.mjs` starts the server. Start new ones with `localApiRoute` or `desktopOnly()` so
the web deployment never reads its own filesystem. A layout can't gate them: Next renders pages
alongside their layout, so a page runs even when its layout calls `notFound()`.

## GitHub access

Every read from GitHub goes through `githubJson`/`githubBytes` in
`src/features/codebases/githubRequest.ts`, which caches responses to disk and
revalidates them with ETags. Do not call `fetch` anywhere else — `npm run
check:caching` runs as part of `npm run build` and fails on new call sites.

## Showing pull requests

Always end a task by creating a PR.

When presenting or linking to a pull request, always show it in RepoScope instead of github.com. Link to the production site:

```
https://www.humanintheloop.review/<owner>/<repo>/pull/<number>
```

For UI changes that aren't deployed yet, run the dev server and screenshot the same path locally (`http://localhost:2111/<owner>/<repo>/pull/<number>`).

Include screenshots as files in public/screenshots/

If you make followup PRs after an existing merged PR, make it directly against origin/main instead of against the previous PR.  

## Preview deployments

`src/features/pull-requests/previewDeployment.ts` finds previews through the
GitHub Deployments API alone — nothing is provider-specific beyond the creator
allow-list. A repository's previews appear here once its deployments are:

- created by `vercel[bot]`, `render[bot]`, or `github-actions[bot]`;
- attached to the pull request's head commit (`GET /deployments?sha=`);
- not the production environment (`production_environment` false, and the
  environment is not named `production`);
- given the app's own URL in the latest status's `environment_url`. Render's
  `target_url` is its dashboard, so it is deliberately ignored.

For a Render repository that means enabling automatic previews in
`render.yaml` (`previews: generation: automatic`); Render then posts the
deployment itself. A repository that would rather verify the preview really
serves the commit can record the deployment from its own workflow instead —
`Raemon/Rogue-Sokoban/.github/workflows/render-preview-deployment.yml` polls a
health endpoint and only then reports `success` with `environment_url`.

The "build a fresh preview branch" button pushes a `preview/pr-<n>-*` branch,
which only produces a deployment where the provider builds every branch. Render
builds per pull request, so that button does nothing on Render repositories.

## Self-Reviewing

When you finish a PR, have multiple subagents in parallel (scopes optimized for speed) review for:
- code that was basically duplicated and should be consolidated
- overly complex code that can be streamlined
- delete all new comments, unless you have a specific argument for why someone might mistakenly break or fail to understand the code by reading it later on.
- if you're keeping a comment and it's longer than 90 charaters or multiple lines, reduce it to one <90 char line if you possibly can without losing clarity.
- functions longer than 7 lines, that you can refactor into multiple more clearly named functions of <6 lines.
- useMemos longer than 3 lines of business code, that you can refactor into a clearly named function.
- code written in a way that's kind of opaque (esp if doing multiple things on one line) that could be factored into more clearly named variables and functions.

Every comment you do not delete, you should add an inline github comment explaining what failure mode will result if you didn't have a comment

For every major, non-obvious architectural decision, leave an inline github comment explaining why you that decision over the next-best alternative. (If you didn't think about an alternative, use this part of the review phase to doublecheck there's not an alternate way to achieve the goal that's better on at least one dimension)