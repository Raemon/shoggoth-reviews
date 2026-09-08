# Shoggoth Reviews

Next.js app for browsing GitHub repositories and pull requests.

- Dev server: `npm run dev` (port 2111)
- Typecheck: `npm run typecheck`
- Production: https://www.humanintheloop.review


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