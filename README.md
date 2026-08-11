# templUI — maintained v1 fork

> **This is a fork of [templui/templui](https://github.com/templui/templui), branched from the last v1 release.**
> It is maintained, and it is **heavily opinionated**. Read [Why this fork exists](#why-this-fork-exists)
> and [What "heavily opinionated" means](#what-heavily-opinionated-means) before depending on it.

Beautifully designed components built with templ and Tailwind CSS. Use the CLI to copy components into your app, or import them directly. Customize everything. Own your code. **Use this to build modern Go applications**.

![hero](./assets/img/readme.png)

## Why this fork exists

Upstream moved on. `templui/templui` became [`axadrn/shadcn-templ`](https://github.com/axadrn/shadcn-templ), and the v2 line is a rewrite rather than an upgrade: the module path changed, and the component set **drops `timepicker`, `datepicker`, `selectbox`, `form`, `rating`, `tagsinput`, `radio` and `dropdown`**, replacing them with base-ui-style ports (`select`, `combobox`, `dropdownmenu`, `radiogroup`, `field`, …).

That is a reasonable direction for a new library and a dead end for an app already built on those components — there is no migration, because the things being migrated to are different components with different APIs. Upstream keeps a `v1` branch alive for its docs site, but v1 is no longer where the work happens.

So this fork continues the v1 line. It is based on upstream's `v1` maintenance branch (v1.13.0 plus its later commits), with the module path and the CLI's default source pointed here.

## What "heavily opinionated" means

This is maintained for the applications that depend on it, not as a neutral community library. Concretely:

- **Changes land because they are needed here.** Features upstream declined get implemented if they solve a real problem — the keyboard-enterable timepicker ([upstream #385](https://github.com/axadrn/shadcn-templ/issues/385), closed as "would require a complete rewrite of the component architecture") is the first of these.
- **Component APIs and markup may break within the v1 line.** Upstream's stability promises do not carry over. Breaking changes are documented in [CHANGELOG.md](CHANGELOG.md) with the reasoning, but they will happen. Pin a version.
- **Not every upstream v1 change is taken.** Fixes are cherry-picked on merit. Some are skipped, and at least one is deliberately *reversed* — see below.
- **Issues and pull requests are welcome but not owed a response.** There is no roadmap commitment, no support guarantee, and no obligation to reach feature parity with upstream v2.

If you want a neutral, community-governed library, use upstream. If you want the v1 component set to keep working and improving, this is that.

## Do not upgrade to upstream v1.13.0

Upstream's newest v1 ships a broken Safari guard. The `:popover-open` fallback added for Safari < 17 calls itself instead of `el.matches()`, so it recurses until the stack overflows and the `catch` turns that into a flat `false`. Four components carry the same copy: `popover`, `dropdown`, `selectbox`, `timepicker`.

In `popover.js` that leaves `isOpen()`, the open/close guards and the click-away check all believing no popover is ever open. **v1.12.1 predates the bug and is unaffected; v1.13.0 and upstream's `v1` HEAD are affected.** It is fixed here.

## Divergence from upstream v1

| Change | Notes |
| --- | --- |
| `timepicker` — keyboard entry | Segmented hour / minute / AM-PM fields you can type into, with the dropdown retained. **Breaking**: `Placeholder` is now the accessible name, not visible text; `ID` moves to the hour field. |
| `popover`, `dropdown`, `selectbox`, `timepicker` — Safari guard | The recursion described above, fixed. |
| Localization props | `HourLabel`, `MinuteLabel`, `PeriodLabel`, `OpenLabel`, `DoneLabel`, `EmptyLabel` on `timepicker`; the dropdown's column headings were previously hardcoded English. |
| `chart` | Upstream's tri-state `Options.Responsive` (`bool` → `*bool`) is carried, and is a breaking API change if you set it. |

The full list, with reasoning, is in [CHANGELOG.md](CHANGELOG.md).

## Usage

Import the packages directly:

```go
import "github.com/RimJur/templui/components/button"
```

```bash
go get github.com/RimJur/templui@latest
```

Or copy the source into your app with the CLI. The CLI built from this repo defaults to this fork; the CLI published by upstream does not, so point it here explicitly:

```bash
TEMPLUI_REPO=RimJur/templui templui add button
```

## Documentation

The component docs are the upstream v1 docs; run them locally with `task dev`. Anything in the [Divergence](#divergence-from-upstream-v1) table above is documented in this repo rather than on templui.io.

## Contributing

Please read the [contributing guide](CONTRIBUTING.md), and the [opinionated](#what-heavily-opinionated-means) caveat above.

## Credit

All of the original design and implementation work is [Axel Adrian](https://github.com/axadrn)'s and templUI's contributors'. This fork exists because that work is worth keeping running, not because there was anything wrong with it. Upstream's current project is [shadcn-templ](https://github.com/axadrn/shadcn-templ).

## License

Licensed under the [MIT license](LICENSE), as upstream is.
